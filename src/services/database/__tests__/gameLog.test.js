import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    execute: vi.fn(),
    dbVars: {
        maxTableSize: 500,
        userPrefix: ''
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
