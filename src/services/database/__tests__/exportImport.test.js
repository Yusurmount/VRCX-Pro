import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    execute: vi.fn(),
    executeNonQuery: vi.fn()
}));

vi.mock('@/services/sqlite', () => ({
    default: {
        execute: (...a) => mocks.execute(...a),
        executeNonQuery: (...a) => mocks.executeNonQuery(...a)
    }
}));

vi.mock('@/plugins/i18n', () => ({
    i18n: { global: { t: (key) => key } }
}));

import { executeImport } from '../exportImport';

function buildPackage() {
    return {
        metadata: { version: 1, exportedAt: '2026-01-01T00:00:00Z', userId: 'usr_1' },
        tables: {
            configs: [
                { key: 'config:savedcredentials', value: 'secret' },
                { key: 'config:theme', value: 'dark' }
            ],
            cookies: [{ name: 'auth', value: 'file-cookie' }],
            feed_post: [
                { id: 1, message: 'hello' },
                { id: 2, message: 'world' }
            ],
            sqlite_sequence: [{ name: 'feed_post', seq: 2 }]
        }
    };
}

function nonQueryCalls(match) {
    return mocks.executeNonQuery.mock.calls.filter(([sql]) => match(sql));
}

function executedSql() {
    return mocks.execute.mock.calls.map(([, sql]) => sql);
}

describe('executeImport restore modes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.execute.mockImplementation(async (callback, sql) => {
            if (sql.includes('sqlite_master')) {
                ['configs', 'cookies', 'feed_post', 'sqlite_sequence'].forEach((name) =>
                    callback([name])
                );
            } else if (sql.includes('table_info')) {
                if (sql.includes('feed_post')) {
                    callback([0, 'id', 'INTEGER', 0, null, 1]);
                    callback([1, 'message', 'TEXT', 0, null, 0]);
                } else if (sql.includes('configs')) {
                    callback([0, 'key', 'TEXT', 0, null, 1]);
                    callback([1, 'value', 'TEXT', 0, null, 0]);
                }
            }
            // full mode must never issue SELECT 1 existence checks
        });
        mocks.executeNonQuery.mockResolvedValue(undefined);
    });

    test('full mode clears data, keeps login state, and inserts every row', async () => {
        const phases = [];
        const result = await executeImport(
            buildPackage(),
            { conflictStrategy: 'skip', newDataStrategy: 'skip', mode: 'full' },
            (state) => phases.push(state.phase)
        );

        expect(result.success).toBe(true);
        expect(result.report.success).toBe(true);

        // Wipe runs in a transaction and never touches the cookies table
        expect(nonQueryCalls((sql) => sql === 'BEGIN')).toHaveLength(1);
        expect(nonQueryCalls((sql) => sql === 'COMMIT')).toHaveLength(1);
        expect(nonQueryCalls((sql) => sql.includes('DELETE FROM "cookies"'))).toHaveLength(0);
        expect(nonQueryCalls((sql) => sql === 'DELETE FROM "feed_post"')).toHaveLength(1);

        // configs is cleared except for the credential/last-login keys
        const configDeletes = nonQueryCalls((sql) => sql.includes('DELETE FROM "configs"'));
        expect(configDeletes).toHaveLength(1);
        const keptKeys = Object.values(configDeletes[0][1]).sort();
        expect(keptKeys).toEqual(['config:lastuserloggedin', 'config:savedcredentials']);

        // No per-row existence lookups: the data is gone, everything is inserted
        expect(executedSql().filter((sql) => sql.includes('SELECT 1 FROM'))).toHaveLength(0);

        // newDataStrategy 'skip' is ignored - full mode always rebuilds from the file
        const feedInserts = nonQueryCalls((sql) => sql.startsWith('INSERT INTO "feed_post"'));
        expect(feedInserts).toHaveLength(2);
        const configInserts = nonQueryCalls((sql) => sql.startsWith('INSERT INTO "configs"'));
        expect(configInserts).toHaveLength(1);
        expect(Object.values(configInserts[0][1])).toContain('dark');
        expect(Object.values(configInserts[0][1])).not.toContain('secret');

        expect(result.report.added).toBe(3);
        expect(result.report.overwritten).toBe(0);

        // Internal + login tables are reported as skipped
        const skipped = Object.fromEntries(
            result.report.tables.filter((t) => t.skipped).map((t) => [t.tableName, t.skipped])
        );
        expect(skipped.cookies).toBe('sensitive');
        expect(skipped.sqlite_sequence).toBe('internal_table');

        expect(phases[0]).toBe('clearing');
        expect(phases).toContain('importing');
    });

    test('incremental mode is unchanged: no wipe, existing rows checked by primary key', async () => {
        mocks.execute.mockImplementation(async (callback, sql, args) => {
            if (sql.includes('sqlite_master')) {
                ['configs', 'cookies', 'feed_post'].forEach((name) => callback([name]));
            } else if (sql.includes('table_info')) {
                if (sql.includes('feed_post')) {
                    callback([0, 'id', 'INTEGER', 0, null, 1]);
                    callback([1, 'message', 'TEXT', 0, null, 0]);
                } else if (sql.includes('configs')) {
                    callback([0, 'key', 'TEXT', 0, null, 1]);
                    callback([1, 'value', 'TEXT', 0, null, 0]);
                }
            } else if (sql.includes('SELECT 1 FROM')) {
                if (args?.['@pk0'] === 1) callback({});
            }
        });

        const phases = [];
        const result = await executeImport(
            buildPackage(),
            { conflictStrategy: 'overwrite', newDataStrategy: 'add' },
            (state) => phases.push(state.phase)
        );

        expect(result.success).toBe(true);
        expect(nonQueryCalls((sql) => sql === 'BEGIN')).toHaveLength(0);
        expect(nonQueryCalls((sql) => sql.startsWith('DELETE FROM'))).toHaveLength(0);
        expect(executedSql().filter((sql) => sql.includes('SELECT 1 FROM')).length).toBeGreaterThan(0);
        expect(phases).not.toContain('clearing');

        // id=1 exists -> overwritten; id=2 and the theme config are new -> added
        expect(result.report.overwritten).toBe(1);
        expect(result.report.added).toBe(2);
    });
});
