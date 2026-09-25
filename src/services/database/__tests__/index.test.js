import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    executeNonQuery: vi.fn()
}));

vi.mock('../../sqlite.js', () => ({
    default: {
        execute: vi.fn(),
        executeNonQuery: (...args) => mocks.executeNonQuery(...args)
    }
}));

import { database } from '../index.js';

describe('database.initUserTables', () => {
    beforeEach(() => {
        mocks.executeNonQuery.mockReset().mockResolvedValue(undefined);
    });

    test('creates the user schema in one database round trip', async () => {
        await database.initUserTables('usr_123');

        expect(mocks.executeNonQuery).toHaveBeenCalledTimes(1);
        const sql = mocks.executeNonQuery.mock.calls[0][0];
        expect(sql).toContain('_friend_log_current');
        expect(sql).toContain('_friend_log_history');
        expect(sql.split(';').length).toBeGreaterThan(20);
    });
});
