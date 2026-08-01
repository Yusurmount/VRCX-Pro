/**
 * Pure logic for the room player list advanced filter.
 * No Vue / DOM dependencies — kept unit-testable.
 */

/** Trust level display values mapped to state keys */
const TRUST_LEVEL_TO_KEY = {
    Visitor: 'Visitor',
    'New User': 'NewUser',
    User: 'User',
    Known: 'Known',
    Trusted: 'Trusted'
};

/** Player platform values mapped to state keys */
const PLATFORM_TO_KEY = {
    standalonewindows: 'pc',
    android: 'android',
    ios: 'ios'
};

const MINUTE_MS = 60000;

/**
 *
 * @returns {object}
 */
export function createDefaultFilterState() {
    return {
        relationship: {
            enabled: false,
            friends: false,
            nonFriends: false
        },
        level: {
            enabled: false,
            levels: {
                Visitor: false,
                NewUser: false,
                User: false,
                Known: false,
                Trusted: false,
                Unknown: false
            }
        },
        keyword: {
            enabled: false,
            searchName: true,
            searchBio: false,
            text: ''
        },
        groups: {
            enabled: false,
            combine: 'AND',
            conditions: []
        },
        mutual: {
            enabled: false,
            targetUserId: '',
            targetDisplayName: ''
        },
        roomHistory: {
            enabled: false,
            firstJoin: {
                enabled: false,
                from: '',
                to: ''
            },
            sessionCount: {
                enabled: false,
                comparison: 'gte', // gte | eq | lte
                count: 1
            },
            onlineDuration: {
                enabled: false,
                minMinutes: 0, // 0 = unlimited
                maxMinutes: 0 // 0 = unlimited
            }
        },
        platform: {
            enabled: false,
            platforms: {
                pc: false,
                android: false,
                ios: false,
                unknown: false
            }
        }
    };
}

/**
 * Deep clone a filter state (preset save/load).
 *
 * @param {object} state
 * @returns {object}
 */
export function cloneFilterState(state) {
    return JSON.parse(JSON.stringify(state ?? null));
}

/**
 * Create a preset record from a name and filter state.
 *
 * @param {string} name
 * @param {object} state
 * @returns {object}
 */
export function createPreset(name, state) {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        filter: cloneFilterState(state)
    };
}

/**
 * Count how many filter groups are enabled AND actually have a value set.
 * Used for the toolbar badge.
 *
 * @param {object} state
 * @returns {number}
 */
export function countActiveFilters(state) {
    if (!state) {
        return 0;
    }
    let count = 0;
    if (state.relationship?.enabled && (state.relationship.friends || state.relationship.nonFriends)) {
        count++;
    }
    if (state.level?.enabled && Object.values(state.level.levels ?? {}).some(Boolean)) {
        count++;
    }
    if (state.keyword?.enabled && state.keyword.text?.trim()) {
        count++;
    }
    if (state.groups?.enabled && (state.groups.conditions ?? []).some((c) => c?.groupId)) {
        count++;
    }
    if (state.mutual?.enabled) {
        count++;
    }
    if (state.roomHistory?.enabled) {
        const rh = state.roomHistory;
        if (rh.firstJoin?.enabled || rh.sessionCount?.enabled || rh.onlineDuration?.enabled) {
            count++;
        }
    }
    if (state.platform?.enabled && Object.values(state.platform.platforms ?? {}).some(Boolean)) {
        count++;
    }
    return count;
}

/**
 * Normalize the raw output of gameLog.getPlayersFromInstance (a Map keyed by
 * displayName with { created_at, displayName, userId, time, count }) into a
 * Map keyed by userId ?? displayName with numeric values.
 *
 * @param {Map<string, object>} playersMap
 * @returns {Map<string, { firstJoin: number|null, joinCount: number, totalTime: number }>}
 */
export function normalizeRoomPlayerStats(playersMap) {
    const stats = new Map();
    for (const entry of (playersMap ?? new Map()).values()) {
        const key = entry?.userId || entry?.displayName;
        if (!key) {
            continue;
        }
        let firstJoin = null;
        if (entry?.created_at) {
            const ts = Date.parse(entry.created_at);
            if (!Number.isNaN(ts)) {
                firstJoin = ts;
            }
        }
        stats.set(key, {
            firstJoin,
            joinCount: typeof entry?.count === 'number' ? entry.count : 0,
            totalTime: typeof entry?.time === 'number' ? entry.time : 0
        });
    }
    return stats;
}

/**
 * Map a player row's platform to a filter key.
 *
 * @param {object} row
 * @returns {string}
 */
function getPlayerPlatformKey(row) {
    const platform = row?.ref?.$platform;
    return PLATFORM_TO_KEY[platform] ?? 'unknown';
}

/**
 * Map a player row's trust level to a filter key.
 *
 * @param {object} row
 * @returns {string}
 */
function getPlayerLevelKey(row) {
    return TRUST_LEVEL_TO_KEY[row?.ref?.$trustLevel] ?? 'Unknown';
}

/**
 * Convert a datetime-local input string to epoch ms (local time), or null.
 *
 * @param {string} value
 * @returns {number|null}
 */
function parseDateTimeLocal(value) {
    if (!value) {
        return null;
    }
    const ts = new Date(value).getTime();
    return Number.isNaN(ts) ? null : ts;
}

/**
 * Whether a player row passes the given filter state.
 * All enabled groups must pass (groups AND each other); options inside a
 * group are OR-ed together.
 *
 * @param {object} row player list row (see instanceStore.updatePlayerListDebounce)
 * @param {object} state filter state
 * @param {object} runtime
 * @param {Map<string, { firstJoin: number|null, joinCount: number, totalTime: number }>} [runtime.roomPlayerStats]
 * @param {Map<string, string[]>} [runtime.mutualSnapshot]
 * @param {Map<string, Set<string>>} [runtime.playerGroupMap] userId -> set of group IDs the player has joined
 * @param {number} [runtime.now] epoch ms used for current-session duration
 * @returns {boolean}
 */
export function matchesPlayerFilters(row, state, runtime = {}) {
    if (!state) {
        return true;
    }

    const rh = state.roomHistory;
    if (rh?.enabled && (rh.firstJoin?.enabled || rh.sessionCount?.enabled || rh.onlineDuration?.enabled)) {
        if (!matchesRoomHistory(row, rh, runtime)) {
            return false;
        }
    }

    if (state.relationship?.enabled) {
        const { friends, nonFriends } = state.relationship;
        if (friends || nonFriends) {
            const isFriend = Boolean(row?.isFriend);
            if (!((friends && isFriend) || (nonFriends && !isFriend))) {
                return false;
            }
        }
    }

    if (state.level?.enabled) {
        const levels = state.level.levels ?? {};
        if (Object.values(levels).some(Boolean)) {
            if (!levels[getPlayerLevelKey(row)]) {
                return false;
            }
        }
    }

    if (state.keyword?.enabled) {
        const text = state.keyword.text?.trim().toLowerCase();
        if (text) {
            let hit = false;
            if (state.keyword.searchName && `${row?.displayName ?? ''}`.toLowerCase().includes(text)) {
                hit = true;
            }
            if (state.keyword.searchBio && `${row?.ref?.bio ?? ''}`.toLowerCase().includes(text)) {
                hit = true;
            }
            if (!hit) {
                return false;
            }
        }
    }

    if (state.groups?.enabled) {
        const conditions = (state.groups.conditions ?? []).filter((c) => c?.groupId);
        if (conditions.length > 0) {
            const check = (cond) => {
                const groups = runtime.playerGroupMap?.get(row?.ref?.id);
                const joined = groups ? groups.has(cond.groupId) : row?.groupOnNameplate === cond.groupId;
                return joined === Boolean(cond.joined);
            };
            if (state.groups.combine === 'OR') {
                if (!conditions.some(check)) {
                    return false;
                }
            } else if (!conditions.every(check)) {
                return false;
            }
        }
    }

    if (state.mutual?.enabled) {
        const mutuals = (runtime.mutualSnapshot ?? new Map()).get(row?.ref?.id) ?? [];
        if (mutuals.length === 0) {
            return false;
        }
        if (state.mutual.targetUserId && !mutuals.includes(state.mutual.targetUserId)) {
            return false;
        }
    }

    if (state.platform?.enabled) {
        const platforms = state.platform.platforms ?? {};
        if (Object.values(platforms).some(Boolean) && !platforms[getPlayerPlatformKey(row)]) {
            return false;
        }
    }

    return true;
}

/**
 * Room-history sub-group matching (first join / session count / online duration).
 *
 * @param {object} row
 * @param {object} rh state.roomHistory
 * @param {object} runtime
 * @returns {boolean}
 */
function matchesRoomHistory(row, rh, runtime) {
    const stats = (runtime.roomPlayerStats ?? new Map()).get(row?.ref?.id || row?.displayName) ?? null;
    const hasTimer = typeof row?.timer === 'number' && row?.timer > 0;

    const firstJoin =
        stats?.firstJoin != null && hasTimer
            ? Math.min(stats.firstJoin, row.timer)
            : stats?.firstJoin ?? (hasTimer ? row.timer : null);
    const sessionCount = stats?.joinCount != null ? stats.joinCount : hasTimer ? 1 : 0;
    const totalTime = (stats?.totalTime ?? 0) + (hasTimer ? (runtime.now ?? Date.now()) - row.timer : 0);

    if (rh.firstJoin?.enabled) {
        if (firstJoin == null) {
            return false;
        }
        const from = parseDateTimeLocal(rh.firstJoin.from);
        const to = parseDateTimeLocal(rh.firstJoin.to);
        if (from != null && firstJoin < from) {
            return false;
        }
        if (to != null && firstJoin > to) {
            return false;
        }
    }

    if (rh.sessionCount?.enabled) {
        const target = Number(rh.sessionCount.count ?? 0);
        switch (rh.sessionCount.comparison) {
            case 'eq':
                if (sessionCount !== target) return false;
                break;
            case 'lte':
                if (sessionCount > target) return false;
                break;
            default:
                if (sessionCount < target) return false;
        }
    }

    if (rh.onlineDuration?.enabled) {
        const minMs = Number(rh.onlineDuration.minMinutes ?? 0) * MINUTE_MS;
        const maxMs = Number(rh.onlineDuration.maxMinutes ?? 0) * MINUTE_MS;
        if (minMs > 0 && totalTime < minMs) {
            return false;
        }
        if (maxMs > 0 && totalTime > maxMs) {
            return false;
        }
    }

    return true;
}
