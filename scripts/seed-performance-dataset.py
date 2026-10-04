#!/usr/bin/env python3
"""Seed synthetic large datasets into a VRCX-Pro SQLite database for performance testing.

Usage:
    python scripts/seed-performance-dataset.py --db <path-to-sqlite> [--scale <multiplier>] [--user-id <vrchat-user-id>]

Behavior (see docs/规格/全栈性能.md, S2 section 2):
- Schema DDL is copied verbatim from src/services/database/index.js
  (initTables / initUserTables): no new tables, no altered columns.
- Idempotent: seed rows use the reserved primary-key segment id >= 900000000.
  All target tables declare `id INTEGER PRIMARY KEY`, so each run first
  deletes that segment and then re-inserts it. (A fallback for tables without
  a filterable column is therefore not needed.)
- Per-user tables (feed_*, friend_log_history) are prefixed like the app does.
  Prefix resolution: --user-id (same transform as computeUserPrefix in
  src/services/database/index.js), else the existing prefix with the most
  feed_gps rows in the DB, else "_perfseed" for empty databases.
- Safety: if the target DB file already exists and <db>.perf-backup does not,
  the file is copied there first (an existing backup is never overwritten).
- Data: fixed RNG seed => reproducible row content; created_at timestamps are
  strictly increasing and spread over the last 365 days relative to run time.
- Inserts are committed in batches of 5000 rows.
"""

import argparse
import os
import random
import shutil
import sqlite3
import sys
import time
from datetime import datetime, timezone

# Reserved seed id segment: seed rows always carry id >= SEED_ID_BASE so that
# re-runs can delete exactly the rows this script inserted (all five target
# tables use `id INTEGER PRIMARY KEY` as their primary key).
SEED_ID_BASE = 900_000_000
BASE_ROWS_PER_TABLE = 100_000
BATCH_SIZE = 5000
RNG_SEED = 'vrcx-pro-perf-seed'
WINDOW_MS = 365 * 24 * 60 * 60 * 1000
DEFAULT_PREFIX = '_perfseed'

# Copied from src/services/database/index.js initTables() (lines 148-166).
GLOBAL_DDL = [
    'CREATE TABLE IF NOT EXISTS gamelog_location (id INTEGER PRIMARY KEY, created_at TEXT, location TEXT, world_id TEXT, world_name TEXT, time INTEGER, group_name TEXT, UNIQUE(created_at, location))',
    'CREATE INDEX IF NOT EXISTS gamelog_location_created_at_idx ON gamelog_location (created_at)',
    'CREATE INDEX IF NOT EXISTS idx_gamelog_location_world_created ON gamelog_location (world_id, created_at)',
    'CREATE TABLE IF NOT EXISTS gamelog_join_leave (id INTEGER PRIMARY KEY, created_at TEXT, type TEXT, display_name TEXT, location TEXT, user_id TEXT, time INTEGER, UNIQUE(created_at, type, display_name))',
    'CREATE INDEX IF NOT EXISTS idx_gamelog_jl_location ON gamelog_join_leave (location)',
    'CREATE INDEX IF NOT EXISTS idx_gamelog_jl_user_created ON gamelog_join_leave (user_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_gamelog_jl_display_created ON gamelog_join_leave (display_name, created_at)'
]

# Copied from src/services/database/index.js initUserTables() (lines 85-92, 128-129);
# {p} is the per-user table prefix.
PREFIXED_DDL = [
    'CREATE TABLE IF NOT EXISTS {p}_feed_gps (id INTEGER PRIMARY KEY, created_at TEXT, user_id TEXT, display_name TEXT, location TEXT, world_name TEXT, previous_location TEXT, time INTEGER, group_name TEXT)',
    'CREATE INDEX IF NOT EXISTS {p}_feed_gps_user_created_idx ON {p}_feed_gps (user_id, created_at)',
    'CREATE TABLE IF NOT EXISTS {p}_feed_status (id INTEGER PRIMARY KEY, created_at TEXT, user_id TEXT, display_name TEXT, status TEXT, status_description TEXT, previous_status TEXT, previous_status_description TEXT)',
    'CREATE INDEX IF NOT EXISTS {p}_feed_status_user_created_idx ON {p}_feed_status (user_id, created_at)',
    'CREATE TABLE IF NOT EXISTS {p}_friend_log_history (id INTEGER PRIMARY KEY, created_at TEXT, type TEXT, user_id TEXT, display_name TEXT, previous_display_name TEXT, trust_level TEXT, previous_trust_level TEXT, friend_number INTEGER)',
    'CREATE INDEX IF NOT EXISTS {p}_friend_log_history_user_id_idx ON {p}_friend_log_history (user_id)'
]

ADJECTIVES = [
    'Neon', 'Swift', 'Cosmic', 'Silent', 'Pixel', 'Frost', 'Ember', 'Lunar',
    'Crystal', 'Shadow', 'Aurora', 'Blaze', 'Misty', 'Quantum', 'Velvet',
    'Storm', 'Candy', 'Drift', 'Hyper', 'Prism'
]
NOUNS = [
    'Fox', 'Owl', 'Wolf', 'Bloom', 'Nova', 'Spark', 'Raven', 'Panda',
    'Kitsune', 'Dragon', 'Mage', 'Pilot', 'Dancer', 'Coder', 'Runner',
    'Whale', 'Bunny', 'Tiger', 'Ghost', 'Comet'
]
WORLD_NAMES = [
    'VRChat Home', 'The Iron Bastion', 'Sunset Beach Club',
    'Neon City Rooftop', 'Cozy Cabin Night', 'Midnight Dance Floor',
    'Avatar World Zero', 'Tutorial Plaza', 'Mystery Box Theater',
    'Starship Bridge', 'Desert Outpost', 'Winter Cabin Vibes',
    'Street Cafe', 'Underwater Dome', 'Space Station Alpha',
    'The Painting Gallery'
]
REGIONS = ['us', 'eu', 'jp', 'oc', 'ap']
# VRChat statuses seen across src/ (friend.js, Vr.vue, FriendsLocations.vue).
STATUSES = ['active', 'ask me', 'busy', 'join me']
STATUS_DESCRIPTIONS = ['', 'VRChat', 'Desktop', 'VRCX']
TRUST_LEVELS = ['Visitor', 'User', 'Known', 'Trusted']
FRIEND_LOG_TYPES = ['Friend', 'Unfriend', 'DisplayName', 'TrustLevel']


def _hex_id(rng, prefix):
    body = ''.join(rng.choice('0123456789abcdef') for _ in range(32))
    return prefix + body


def _display_name(rng):
    return rng.choice(ADJECTIVES) + rng.choice(NOUNS) + str(rng.randrange(100, 1000))


class Pools:
    """Deterministic cast of users/worlds shared by every table generator."""

    def __init__(self):
        rng = random.Random(RNG_SEED + '|pools')
        self.friends = [
            (_hex_id(rng, 'usr_'), _display_name(rng)) for _ in range(400)
        ]
        self.worlds = [
            (_hex_id(rng, 'wrld_'), rng.choice(WORLD_NAMES)) for _ in range(60)
        ]

    def friend(self, rng):
        return self.friends[rng.randrange(len(self.friends))]

    def other_display_name(self, rng):
        return self.friends[rng.randrange(len(self.friends))][1]

    def world(self, rng):
        return self.worlds[rng.randrange(len(self.worlds))]

    def location(self, rng, world_id):
        instance = rng.randrange(1, 100000)
        roll = rng.random()
        if roll < 0.15:
            return f'{world_id}:{instance}~private'
        if roll < 0.3:
            return f'{world_id}:{instance}~friends'
        return f'{world_id}:{instance}~{rng.choice(REGIONS)}'

    def previous_location(self, rng):
        if rng.random() < 0.6:
            world_id, _ = self.world(rng)
            return self.location(rng, world_id)
        return rng.choice(['', 'offline', 'traveling', 'private'])


def gen_gamelog_location(pools, rng, ts):
    world_id, world_name = pools.world(rng)
    location = pools.location(rng, world_id)
    time_s = rng.randrange(60, 5400)
    group_name = '' if rng.random() < 0.8 else 'Perf Group'
    return (ts, location, world_id, world_name, time_s, group_name)


def gen_gamelog_join_leave(pools, rng, ts):
    user_id, display_name = pools.friend(rng)
    world_id, _ = pools.world(rng)
    location = pools.location(rng, world_id)
    is_join = rng.random() < 0.5
    type_ = 'OnPlayerJoined' if is_join else 'OnPlayerLeft'
    # OnPlayerLeft rows carry the seconds spent in the instance; joins are 0.
    time_s = 0 if is_join else rng.randrange(30, 7200)
    return (ts, type_, display_name, location, user_id, time_s)


def gen_feed_gps(pools, rng, ts):
    user_id, display_name = pools.friend(rng)
    world_id, world_name = pools.world(rng)
    location = pools.location(rng, world_id)
    previous_location = pools.previous_location(rng)
    time_s = rng.randrange(60, 7200)
    group_name = '' if rng.random() < 0.85 else 'Perf Group'
    return (
        ts, user_id, display_name, location, world_name,
        previous_location, time_s, group_name
    )


def gen_feed_status(pools, rng, ts):
    user_id, display_name = pools.friend(rng)
    status = rng.choice(STATUSES)
    status_description = rng.choice(STATUS_DESCRIPTIONS)
    previous_status = rng.choice(STATUSES + ['offline'])
    previous_status_description = (
        '' if previous_status == 'offline' else rng.choice(STATUS_DESCRIPTIONS)
    )
    return (
        ts, user_id, display_name, status, status_description,
        previous_status, previous_status_description
    )


def gen_friend_log_history(pools, rng, ts):
    user_id, display_name = pools.friend(rng)
    type_ = FRIEND_LOG_TYPES[rng.randrange(len(FRIEND_LOG_TYPES))]
    previous_display_name = ''
    trust_level = ''
    previous_trust_level = ''
    if type_ == 'DisplayName':
        previous_display_name = pools.other_display_name(rng)
    elif type_ == 'TrustLevel':
        trust_level = rng.choice(TRUST_LEVELS)
        previous_trust_level = rng.choice(TRUST_LEVELS + [''])
    friend_number = rng.randrange(0, 1200)
    return (
        ts, type_, user_id, display_name, previous_display_name,
        trust_level, previous_trust_level, friend_number
    )


# (table name template, value columns in CREATE TABLE order, row generator)
TABLES = [
    (
        'gamelog_location',
        ['created_at', 'location', 'world_id', 'world_name', 'time', 'group_name'],
        gen_gamelog_location
    ),
    (
        'gamelog_join_leave',
        ['created_at', 'type', 'display_name', 'location', 'user_id', 'time'],
        gen_gamelog_join_leave
    ),
    (
        '{p}_feed_gps',
        ['created_at', 'user_id', 'display_name', 'location', 'world_name',
         'previous_location', 'time', 'group_name'],
        gen_feed_gps
    ),
    (
        '{p}_feed_status',
        ['created_at', 'user_id', 'display_name', 'status',
         'status_description', 'previous_status', 'previous_status_description'],
        gen_feed_status
    ),
    (
        '{p}_friend_log_history',
        ['created_at', 'type', 'user_id', 'display_name',
         'previous_display_name', 'trust_level', 'previous_trust_level',
         'friend_number'],
        gen_friend_log_history
    )
]


def compute_user_prefix(user_id):
    # Mirrors computeUserPrefix() in src/services/database/index.js.
    prefix = user_id.replace('-', '').replace('_', '')
    if prefix[:1].isdigit():
        prefix = '_' + prefix
    return prefix or DEFAULT_PREFIX


def detect_prefix(conn):
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' "
        "AND name LIKE '%!_feed!_gps' ESCAPE '!'"
    ).fetchall()
    candidates = [name[:-len('_feed_gps')] for (name,) in rows]
    if not candidates:
        return None
    # Prefer the prefix with the most feed_gps rows (most active account).
    best, best_count = None, -1
    for prefix in candidates:
        count = conn.execute(
            f'SELECT COUNT(*) FROM "{prefix}_feed_gps"'
        ).fetchone()[0]
        if count > best_count:
            best, best_count = prefix, count
    return best


def iso_utc(ms):
    dt = datetime.fromtimestamp(ms // 1000, tz=timezone.utc)
    return dt.strftime('%Y-%m-%dT%H:%M:%S.') + f'{ms % 1000:03d}Z'


def seed_table(conn, name, columns, generator, pools, n, start_ms, end_ms):
    quoted = f'"{name}"'
    cur = conn.execute(f'DELETE FROM {quoted} WHERE id >= ?', (SEED_ID_BASE,))
    deleted = cur.rowcount
    conn.commit()

    placeholders = ', '.join(['?'] * (len(columns) + 1))
    insert_sql = (
        f'INSERT INTO {quoted} (id, {", ".join(columns)}) VALUES ({placeholders})'
    )
    rng = random.Random(f'{RNG_SEED}|{name}')
    span = max(end_ms - start_ms, 1)
    step = max(span // max(n, 1), 1)
    batch = []
    for i in range(n):
        # Strictly increasing timestamps (ts[i+1] - ts[i] >= 1ms), so the
        # UNIQUE(created_at, ...) constraints on the gamelog tables hold.
        ts_ms = start_ms + i * step + rng.randrange(step)
        row = (SEED_ID_BASE + i,) + generator(pools, rng, iso_utc(ts_ms))
        batch.append(row)
        if len(batch) >= BATCH_SIZE:
            conn.executemany(insert_sql, batch)
            conn.commit()
            batch = []
    if batch:
        conn.executemany(insert_sql, batch)
        conn.commit()

    total = conn.execute(f'SELECT COUNT(*) FROM {quoted}').fetchone()[0]
    seed_count = conn.execute(
        f'SELECT COUNT(*) FROM {quoted} WHERE id >= ?', (SEED_ID_BASE,)
    ).fetchone()[0]
    print(f'  {name}: total={total}, seed={seed_count} (removed old seed rows: {deleted})')
    return total, seed_count


def default_db_path():
    appdata = os.environ.get('APPDATA')
    if not appdata:
        return None
    return os.path.join(appdata, 'VRCX', 'VRCX.sqlite3')


def main(argv=None):
    parser = argparse.ArgumentParser(
        description='Seed synthetic performance-test data into a VRCX-Pro SQLite database.'
    )
    parser.add_argument(
        '--db',
        default=None,
        help='Path to the SQLite database (default: %%APPDATA%%/VRCX/VRCX.sqlite3)'
    )
    parser.add_argument(
        '--scale',
        type=float,
        default=1.0,
        help='Multiplier for per-table row count; 1 = 100000 rows/table (default: 1)'
    )
    parser.add_argument(
        '--user-id',
        default=None,
        help='VRChat user id; selects/creates the per-user table prefix exactly '
             'like the app would (default: detect from DB, else "_perfseed")'
    )
    args = parser.parse_args(argv)

    if args.scale < 0:
        parser.error('--scale must be >= 0')

    db_path = args.db or default_db_path()
    if not db_path:
        parser.error('--db is required because APPDATA is not set')

    if os.path.exists(db_path):
        backup_path = db_path + '.perf-backup'
        if os.path.exists(backup_path):
            print(f'Backup already exists, not overwritten: {backup_path}')
        else:
            shutil.copy2(db_path, backup_path)
            print(f'Backed up existing DB to: {backup_path}')
    else:
        print(f'Target DB does not exist yet, no backup needed: {db_path}')
        parent = os.path.dirname(db_path)
        if parent:
            os.makedirs(parent, exist_ok=True)

    n_rows = int(BASE_ROWS_PER_TABLE * args.scale)
    now_ms = int(time.time() * 1000)
    start_ms = now_ms - WINDOW_MS

    conn = sqlite3.connect(db_path)
    try:
        if args.user_id:
            prefix = compute_user_prefix(args.user_id)
        else:
            prefix = detect_prefix(conn) or DEFAULT_PREFIX
        print(f'DB: {db_path}')
        print(f'Prefix: {prefix}')
        print(f'Scale: {args.scale} -> {n_rows} rows per table')

        for stmt in GLOBAL_DDL:
            conn.execute(stmt)
        for stmt in PREFIXED_DDL:
            conn.execute(stmt.format(p=prefix))
        conn.commit()

        pools = Pools()
        print('Seeding:')
        results = []
        for template, columns, generator in TABLES:
            table = template.format(p=prefix)
            results.append(
                seed_table(
                    conn, table, columns, generator, pools,
                    n_rows, start_ms, now_ms
                )
            )

        print('Summary (total rows, seed rows):')
        for (template, _columns, _generator), (total, seed_count) in zip(TABLES, results):
            print(f'  {template.format(p=prefix)}: {total}, {seed_count}')
    finally:
        conn.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
