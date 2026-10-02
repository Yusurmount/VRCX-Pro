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

import { friendLogHistory } from '../friendLogHistory.js';

const DECLARED_PARAMS = [
    '@created_at',
    '@type',
    '@user_id',
    '@display_name',
    '@previous_display_name',
    '@trust_level',
    '@previous_trust_level',
    '@friend_number'
];

/**
 * The sidecar fails the whole statement when the SQL declares a parameter the
 * args object does not carry, so every entry type must still send all of them.
 * @param {object} entry
 * @returns {object}
 */
function insertAndReadArgs(entry) {
    mocks.executeNonQuery.mockClear();
    friendLogHistory.addFriendLogHistory(entry);
    expect(mocks.executeNonQuery).toHaveBeenCalledTimes(1);
    return mocks.executeNonQuery.mock.calls[0][1];
}

describe('friendLogHistory.addFriendLogHistory', () => {
    beforeEach(() => {
        mocks.executeNonQuery.mockReset().mockResolvedValue(0);
    });

    test('every declared parameter is present for a DisplayName entry', () => {
        const args = insertAndReadArgs({
            created_at: '2026-10-02T00:00:00.000Z',
            type: 'DisplayName',
            userId: 'usr_1',
            displayName: 'New',
            previousDisplayName: 'Old',
            friendNumber: 3
        });

        expect(Object.keys(args).sort()).toEqual([...DECLARED_PARAMS].sort());
        for (const name of DECLARED_PARAMS) {
            expect(args[name]).not.toBeUndefined();
        }
        expect(args['@previous_display_name']).toBe('Old');
        expect(args['@trust_level']).toBe('');
        expect(args['@previous_trust_level']).toBe('');
    });

    test('every declared parameter is present for a TrustLevel entry', () => {
        const args = insertAndReadArgs({
            created_at: '2026-10-02T00:00:01.000Z',
            type: 'TrustLevel',
            userId: 'usr_1',
            displayName: 'Who',
            trustLevel: 'Trusted User',
            previousTrustLevel: 'Known User',
            friendNumber: 9
        });

        expect(Object.keys(args).sort()).toEqual([...DECLARED_PARAMS].sort());
        expect(args['@previous_display_name']).toBe('');
        expect(args['@previous_trust_level']).toBe('Known User');
    });

    test('every declared parameter is present for an Unfriend entry', () => {
        const args = insertAndReadArgs({
            created_at: '2026-10-02T00:00:02.000Z',
            type: 'Unfriend',
            userId: 'usr_1',
            displayName: 'Who'
        });

        expect(Object.keys(args).sort()).toEqual([...DECLARED_PARAMS].sort());
        expect(args['@friend_number']).toBe(0);
        expect(args['@trust_level']).toBe('');
    });

    test('keeps a friendNumber of 0 instead of treating it as absent', () => {
        const args = insertAndReadArgs({
            created_at: '2026-10-02T00:00:03.000Z',
            type: 'Friend',
            userId: 'usr_1',
            displayName: 'Who',
            friendNumber: 0
        });

        expect(args['@friend_number']).toBe(0);
    });
});
