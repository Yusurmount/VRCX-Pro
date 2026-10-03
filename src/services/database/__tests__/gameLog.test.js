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

    function mockSessionQueries({
        mySessions = [],
        friendSessions = [],
        friendNumbers
    }) {
        // Default: every co-presence uid counts as a current friend; tests
        // that exercise the friend filter pass an explicit friendNumbers row.
        const friendRows =
            friendNumbers !== undefined
                ? friendNumbers
                : [...new Set(friendSessions.map((r) => r[0]))].map((uid) => [
                      uid,
                      1
                  ]);
        mocks.execute.mockImplementation(async (callback, sql) => {
            let rows;
            if (sql.includes('friend_log_current')) {
                rows = friendRows;
            } else if (sql.includes('AS src')) {
                rows = friendSessions;
            } else {
                rows = mySessions;
            }
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
        expect(row.totalTime).toBe(15 * 60 * 1000);
        expect(row.joinCount).toBe(1);
        expect(row.firstSeen).toBe('2026-10-01T10:00:00.000Z');
        expect(row.lastSeen).toBe('2026-10-01T10:15:00.000Z');
        expect(row.distinctDays).toBe(1);
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

    test('chains reconnect gaps under four minutes into one meeting', async () => {
        mockSessionQueries({
            mySessions: [[MY_LOC, '2026-10-01T12:00:00.000Z', 3600000]],
            friendSessions: [
                // 11:00 -> 11:10 and 11:12 -> 11:20: a 2-minute drop.
                ['usr_f4', 'Friend Four', MY_LOC, '2026-10-01T11:10:00.000Z', 600000, 1],
                ['usr_f4', 'Friend Four', MY_LOC, '2026-10-01T11:20:00.000Z', 480000, 1]
            ]
        });

        const [row] = await gameLog.getFriendshipMetrics();
        expect(row.joinCount).toBe(1);
        // Real blocks sum; the 2-minute gap is never invented into total time.
        expect(row.totalTime).toBe((600000 + 480000));
    });

    test('counts a gap over four minutes as a separate meeting', async () => {
        mockSessionQueries({
            mySessions: [[MY_LOC, '2026-10-01T12:00:00.000Z', 3600000]],
            friendSessions: [
                ['usr_f5', 'Friend Five', MY_LOC, '2026-10-01T11:10:00.000Z', 600000, 1],
                // 11:10 end, next starts 11:20: a 10-minute gap.
                ['usr_f5', 'Friend Five', MY_LOC, '2026-10-01T11:30:00.000Z', 600000, 1]
            ]
        });

        const [row] = await gameLog.getFriendshipMetrics();
        expect(row.joinCount).toBe(2);
    });

    test('reports trend windows, week coverage, friend number, and initiative', async () => {
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        // Feed rows describe the friend's dwell: [leaveTime, durationMs].
        // My session always ends at the same leave time.
        // Friend start vs my start decides who showed up second.
        const meeting = (offsetDays, { friendCameToMe, durationMs = 1800000 }) => {
            const leave = new Date(now - offsetDays * day).toISOString();
            const mine = friendCameToMe
                ? // I was there an hour; they joined for the last 30 min.
                  [leave, 3600000]
                : // They were there an hour; I joined for the last 30 min.
                  [leave, 1800000];
            const theirs = friendCameToMe
                ? [leave, durationMs]
                : [leave, 3600000];
            return { mine, theirs };
        };
        const m1 = meeting(1, { friendCameToMe: true });
        const m10 = meeting(10, { friendCameToMe: false });
        const m40 = meeting(40, { friendCameToMe: true });
        const m80 = meeting(80, { friendCameToMe: false });

        mockSessionQueries({
            mySessions: [m1.mine, m10.mine, m40.mine, m80.mine].map(
                ([leave, durationMs]) => [MY_LOC, leave, durationMs]
            ),
            friendSessions: [m1, m10, m40, m80].map((m) => [
                'usr_f6',
                'Friend Six',
                MY_LOC,
                m.theirs[0],
                m.theirs[1],
                2
            ]),
            friendNumbers: [['usr_f6', 7]]
        });

        const [row] = await gameLog.getFriendshipMetrics();
        expect(row.friendNumber).toBe(7);
        expect(row.friendInitiated).toBe(2);
        expect(row.selfInitiated).toBe(2);
        // Days 1 and 10 land in the last 30 days: 2 × 30 min.
        expect(row.time30d).toBe(2 * 1800000);
        // Day 40 lands in the previous 30-day window: 30 min.
        expect(row.timePrev30d).toBe(1800000);
        // The 90-day window covers everything here (all within 80 days).
        expect(row.time90d).toBe(row.totalTime);
        // Ends at days 1, 10, 40, 80: four distinct weeks.
        expect(row.activeWeeks).toBe(4);
    });

    test('drops a co-presence passer-by who is not in the current friend log', async () => {
        mockSessionQueries({
            mySessions: [[MY_LOC, '2026-10-01T10:30:00.000Z', 1800000]],
            friendSessions: [
                ['usr_f1', 'Friend One', MY_LOC, '2026-10-01T10:15:00.000Z', 1800000, 1],
                ['usr_stranger', 'Passer-by', MY_LOC, '2026-10-01T10:15:00.000Z', 1800000, 1]
            ],
            // Only Friend One is on the current friend list.
            friendNumbers: [['usr_f1', 3]]
        });

        const rows = await gameLog.getFriendshipMetrics();
        expect(rows.map((r) => r.userId)).toEqual(['usr_f1']);
    });

    test('returns nothing without a user context', async () => {
        mocks.dbVars.userPrefix = '';
        await expect(gameLog.getFriendshipMetrics()).resolves.toEqual([]);
        mocks.dbVars.userPrefix = 'usrtest';
        mocks.dbVars.userId = '';
        await expect(gameLog.getFriendshipMetrics()).resolves.toEqual([]);
    });
});
