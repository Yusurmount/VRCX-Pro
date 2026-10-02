import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    execute: vi.fn(),
    dbVars: {
        maxTableSize: 500,
        userPrefix: '',
        userId: ''
    }
}));

vi.mock('../../sqlite.js', () => ({
    default: {
        execute: mocks.execute,
        executeNonQuery: vi.fn()
    }
}));
vi.mock('../index.js', () => ({
    dbVars: mocks.dbVars
}));

import { gameLog } from '../gameLog.js';

describe('gameLog.getMyTopWorlds', () => {
    beforeEach(() => {
        mocks.execute.mockReset();
    });

    test('adds an exclude clause when a home world id is provided', async () => {
        mocks.execute.mockImplementation(async (callback, sql, params) => {
            callback(['wrld_1', 'World One', 3, 9000]);
            return undefined;
        });

        const result = await gameLog.getMyTopWorlds(30, 5, 'time', 'wrld_home');

        expect(result).toEqual([
            {
                worldId: 'wrld_1',
                worldName: 'World One',
                visitCount: 3,
                totalTime: 9000
            }
        ]);
        expect(mocks.execute).toHaveBeenCalledTimes(1);
        expect(mocks.execute.mock.calls[0][1]).toContain(
            'AND world_id != @excludeWorldId'
        );
        expect(mocks.execute.mock.calls[0][2]).toMatchObject({
            '@limit': 5,
            '@daysOffset': '-30 days',
            '@excludeWorldId': 'wrld_home'
        });
    });
});

describe('gameLog.getGamelogDatabase', () => {
    beforeEach(() => {
        mocks.execute.mockReset();
        mocks.dbVars.maxTableSize = 500;
    });

    test('keeps all rows when the configured table size is unlimited', async () => {
        mocks.dbVars.maxTableSize = -1;
        mocks.execute.mockImplementation(async (callback, sql) => {
            if (sql.includes('FROM gamelog_location')) {
                callback([
                    1,
                    '2026-09-26T04:42:42.000Z',
                    'wrld_example:123~region(jp)',
                    'wrld_example',
                    'Example World',
                    10,
                    ''
                ]);
            }
            if (sql.includes('FROM gamelog_join_leave')) {
                callback([
                    2,
                    '2026-09-26T04:42:54.000Z',
                    'OnPlayerJoined',
                    'Example Player',
                    'wrld_example:123~region(jp)',
                    'usr_example',
                    12
                ]);
            }
        });

        const result = await gameLog.getGamelogDatabase();

        expect(result).toHaveLength(2);
        expect(result.map((row) => row.type)).toEqual([
            'Location',
            'OnPlayerJoined'
        ]);
    });
});

describe('gameLog.getFriendshipMetrics', () => {
    const MY_ID = 'usr_me';
    const MY_LOC = 'wrld_a:1~region(jp)';
    const OTHER_LOC = 'wrld_b:2~region(jp)';

    function mockSessionQueries({ mySessions = [], friendSessions = [] }) {
        mocks.execute.mockImplementation(async (callback, sql) => {
            const rows = sql.includes('AS src') ? friendSessions : mySessions;
            for (const row of rows) callback(row);
        });
    }

    beforeEach(() => {
        mocks.execute.mockReset();
        mocks.dbVars.userPrefix = 'usrtest';
        mocks.dbVars.userId = MY_ID;
    });

    test('drops a feed session that never overlapped mine', async () => {
        mockSessionQueries({
            mySessions: [[MY_LOC, '2026-10-01T10:30:00.000Z', 1800000]],
            // Friend sat in that instance an hour before I joined it.
            friendSessions: [
                ['usr_f1', 'Friend One', MY_LOC, '2026-10-01T09:00:00.000Z', 3600000, 2]
            ]
        });

        await expect(gameLog.getFriendshipMetrics()).resolves.toEqual([]);
    });

    test('clips a feed session to the time I was actually there', async () => {
        mockSessionQueries({
            mySessions: [[MY_LOC, '2026-10-01T10:30:00.000Z', 1800000]],
            // 09:45 -> 10:15, I was there 10:00 -> 10:30: 15 minutes count.
            friendSessions: [
                ['usr_f1', 'Friend One', MY_LOC, '2026-10-01T10:15:00.000Z', 1800000, 2]
            ]
        });

        const [row] = await gameLog.getFriendshipMetrics();
        expect(row).toEqual({
            userId: 'usr_f1',
            displayName: 'Friend One',
            totalTime: 15 * 60 * 1000,
            joinCount: 1,
            firstSeen: '2026-10-01T10:00:00.000Z',
            lastSeen: '2026-10-01T10:15:00.000Z',
            distinctDays: 1
        });
    });

    test('keeps a game-log session even when I have no leave row for it', async () => {
        mockSessionQueries({
            mySessions: [],
            friendSessions: [
                ['usr_f2', 'Friend Two', OTHER_LOC, '2026-09-20T12:30:00.000Z', 1800000, 1]
            ]
        });

        const [row] = await gameLog.getFriendshipMetrics();
        expect(row.totalTime).toBe(1800000);
        expect(row.joinCount).toBe(1);
        expect(row.firstSeen).toBe('2026-09-20T12:00:00.000Z');
        expect(row.lastSeen).toBe('2026-09-20T12:30:00.000Z');
    });

    test('merges overlapping game-log and feed sessions into one meeting', async () => {
        mockSessionQueries({
            mySessions: [[OTHER_LOC, '2026-09-20T13:00:00.000Z', 7200000]],
            friendSessions: [
                ['usr_f3', 'Friend Three', OTHER_LOC, '2026-09-20T12:30:00.000Z', 1800000, 1],
                ['usr_f3', 'Friend Three', OTHER_LOC, '2026-09-20T12:40:00.000Z', 1800000, 2]
            ]
        });

        const [row] = await gameLog.getFriendshipMetrics();
        expect(row.totalTime).toBe(40 * 60 * 1000);
        expect(row.joinCount).toBe(1);
        expect(row.firstSeen).toBe('2026-09-20T12:00:00.000Z');
        expect(row.lastSeen).toBe('2026-09-20T12:40:00.000Z');
    });

    test('orders friends by co-presence time', async () => {
        mockSessionQueries({
            mySessions: [
                [MY_LOC, '2026-10-01T11:00:00.000Z', 7200000],
                [OTHER_LOC, '2026-10-01T11:00:00.000Z', 7200000]
            ],
            friendSessions: [
                ['usr_small', 'Small', MY_LOC, '2026-10-01T09:10:00.000Z', 1200000, 2],
                ['usr_big', 'Big', OTHER_LOC, '2026-10-01T10:40:00.000Z', 1200000, 2]
            ]
        });

        const rows = await gameLog.getFriendshipMetrics();
        expect(rows.map((r) => r.userId)).toEqual(['usr_big', 'usr_small']);
        expect(rows[0].totalTime).toBeGreaterThan(rows[1].totalTime);
    });

    test('returns nothing without a user context', async () => {
        mocks.dbVars.userPrefix = '';
        await expect(gameLog.getFriendshipMetrics()).resolves.toEqual([]);
        mocks.dbVars.userPrefix = 'usrtest';
        mocks.dbVars.userId = '';
        await expect(gameLog.getFriendshipMetrics()).resolves.toEqual([]);
    });
});
