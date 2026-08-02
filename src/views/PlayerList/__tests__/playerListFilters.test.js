import {
    cloneFilterState,
    countActiveFilters,
    createDefaultFilterState,
    createPreset,
    matchesPlayerFilters,
    normalizeRoomPlayerStats
} from '../playerListFilters';

/**
 * Build a minimal player row mirroring instanceStore player list rows.
 * @param {object} [overrides]
 */
function makeRow(overrides = {}) {
    return {
        ref: {
            id: 'usr_test',
            $platform: 'standalonewindows',
            $trustLevel: 'User',
            bio: ''
        },
        displayName: 'TestUser',
        isFriend: false,
        timer: 0,
        groupOnNameplate: '',
        ...overrides
    };
}

function makeRuntime(overrides = {}) {
    return {
        roomPlayerStats: new Map(),
        mutualSnapshot: new Map(),
        now: 1_000_000,
        ...overrides
    };
}

describe('createDefaultFilterState / cloneFilterState / createPreset', () => {
    test('returns a fresh deep structure on each call', () => {
        const a = createDefaultFilterState();
        const b = createDefaultFilterState();
        expect(a).not.toBe(b);
        expect(a.relationship).not.toBe(b.relationship);
        expect(a.levels).toBeUndefined();
    });

    test('cloneFilterState deep-copies and survives mutation of source', () => {
        const state = createDefaultFilterState();
        state.keyword.text = 'abc';
        const clone = cloneFilterState(state);
        state.keyword.text = 'xyz';
        expect(clone.keyword.text).toBe('abc');
        expect(clone).not.toBe(state);
        expect(clone.keyword).not.toBe(state.keyword);
    });

    test('cloneFilterState handles null', () => {
        expect(cloneFilterState(null)).toBe(null);
    });

    test('createPreset snapshots the filter state', () => {
        const state = createDefaultFilterState();
        state.keyword.text = 'abc';
        const preset = createPreset('My Preset', state);
        expect(preset.name).toBe('My Preset');
        expect(preset.id).toBeTruthy();
        state.keyword.text = 'xyz';
        expect(preset.filter.keyword.text).toBe('abc');
    });
});

describe('countActiveFilters', () => {
    test('returns 0 for default state', () => {
        expect(countActiveFilters(createDefaultFilterState())).toBe(0);
    });

    test('returns 0 for null state', () => {
        expect(countActiveFilters(null)).toBe(0);
    });

    test('counts each enabled group with a value set', () => {
        const state = createDefaultFilterState();
        state.relationship.enabled = true;
        state.relationship.friends = true;
        state.keyword.enabled = true;
        state.keyword.text = '  abc  ';
        state.platform.enabled = true;
        state.platform.platforms.pc = true;
        state.roomHistory.enabled = true;
        state.roomHistory.sessionCount.enabled = true;
        state.mutual.enabled = true;
        expect(countActiveFilters(state)).toBe(5);
    });

    test('ignores enabled groups without values', () => {
        const state = createDefaultFilterState();
        state.relationship.enabled = true; // no friends/nonFriends
        state.keyword.enabled = true; // empty text
        state.groups.enabled = true; // no conditions
        state.roomHistory.enabled = true; // no sub-item enabled
        state.platform.enabled = true; // no platforms
        expect(countActiveFilters(state)).toBe(0);
    });
});

describe('normalizeRoomPlayerStats', () => {
    test('normalizes entries keyed by userId', () => {
        const raw = new Map([
            [
                'Alice',
                {
                    created_at: '2026-07-01T10:00:00Z',
                    displayName: 'Alice',
                    userId: 'usr_a',
                    time: 120000,
                    count: 3
                }
            ]
        ]);
        const stats = normalizeRoomPlayerStats(raw);
        expect(stats.size).toBe(1);
        const entry = stats.get('usr_a');
        expect(entry).toEqual({
            firstJoin: Date.parse('2026-07-01T10:00:00Z'),
            joinCount: 3,
            totalTime: 120000
        });
    });

    test('falls back to displayName when userId missing', () => {
        const raw = new Map([
            [
                'Bob',
                {
                    created_at: '2026-07-01T10:00:00Z',
                    displayName: 'Bob',
                    count: 1
                }
            ]
        ]);
        expect(normalizeRoomPlayerStats(raw).has('Bob')).toBe(true);
    });

    test('skips entries without any key and tolerates null map', () => {
        const raw = new Map([['x', { created_at: null, count: 1 }]]);
        expect(normalizeRoomPlayerStats(raw).size).toBe(0);
        expect(normalizeRoomPlayerStats(null).size).toBe(0);
    });

    test('treats invalid created_at as null firstJoin', () => {
        const raw = new Map([
            [
                'x',
                {
                    displayName: 'x',
                    userId: 'usr_x',
                    created_at: 'not-a-date',
                    count: 0
                }
            ]
        ]);
        expect(normalizeRoomPlayerStats(raw).get('usr_x').firstJoin).toBe(null);
    });
});

describe('matchesPlayerFilters — default state', () => {
    test('returns true for any row when state is null or empty', () => {
        expect(matchesPlayerFilters(makeRow(), null)).toBe(true);
        expect(
            matchesPlayerFilters(makeRow(), createDefaultFilterState())
        ).toBe(true);
    });
});

describe('matchesPlayerFilters — relationship', () => {
    test('matches friends only', () => {
        const state = createDefaultFilterState();
        state.relationship.enabled = true;
        state.relationship.friends = true;
        expect(matchesPlayerFilters(makeRow({ isFriend: true }), state)).toBe(
            true
        );
        expect(matchesPlayerFilters(makeRow({ isFriend: false }), state)).toBe(
            false
        );
    });

    test('matches non-friends only', () => {
        const state = createDefaultFilterState();
        state.relationship.enabled = true;
        state.relationship.nonFriends = true;
        expect(matchesPlayerFilters(makeRow({ isFriend: false }), state)).toBe(
            true
        );
        expect(matchesPlayerFilters(makeRow({ isFriend: true }), state)).toBe(
            false
        );
    });

    test('matches either when both checked', () => {
        const state = createDefaultFilterState();
        state.relationship.enabled = true;
        state.relationship.friends = true;
        state.relationship.nonFriends = true;
        expect(matchesPlayerFilters(makeRow({ isFriend: true }), state)).toBe(
            true
        );
        expect(matchesPlayerFilters(makeRow({ isFriend: false }), state)).toBe(
            true
        );
    });
});

describe('matchesPlayerFilters — level', () => {
    test('matches exact trust level', () => {
        const state = createDefaultFilterState();
        state.level.enabled = true;
        state.level.levels.Trusted = true;
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'a', $trustLevel: 'Trusted' } }),
                state
            )
        ).toBe(true);
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'a', $trustLevel: 'User' } }),
                state
            )
        ).toBe(false);
    });

    test('maps "New User" to NewUser key', () => {
        const state = createDefaultFilterState();
        state.level.enabled = true;
        state.level.levels.NewUser = true;
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'a', $trustLevel: 'New User' } }),
                state
            )
        ).toBe(true);
    });

    test('treats unknown/missing trust level as Unknown', () => {
        const state = createDefaultFilterState();
        state.level.enabled = true;
        state.level.levels.Unknown = true;
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'a', $trustLevel: undefined } }),
                state
            )
        ).toBe(true);
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'a', $trustLevel: 'WeirdLevel' } }),
                state
            )
        ).toBe(true);
    });
});

describe('matchesPlayerFilters — keyword', () => {
    test('matches displayName case-insensitively', () => {
        const state = createDefaultFilterState();
        state.keyword.enabled = true;
        state.keyword.searchName = true;
        state.keyword.text = 'ALICE';
        expect(
            matchesPlayerFilters(
                makeRow({ displayName: 'alice-in-wonderland' }),
                state
            )
        ).toBe(true);
    });

    test('matches bio when searchBio enabled', () => {
        const state = createDefaultFilterState();
        state.keyword.enabled = true;
        state.keyword.searchName = false;
        state.keyword.searchBio = true;
        state.keyword.text = 'hello';
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'a', bio: 'Hello there' } }),
                state
            )
        ).toBe(true);
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'a', bio: 'nope' } }),
                state
            )
        ).toBe(false);
    });

    test('no match when neither field checked', () => {
        const state = createDefaultFilterState();
        state.keyword.enabled = true;
        state.keyword.searchName = false;
        state.keyword.searchBio = false;
        state.keyword.text = 'hello';
        expect(
            matchesPlayerFilters(makeRow({ displayName: 'hello' }), state)
        ).toBe(false);
    });

    test('empty text never excludes', () => {
        const state = createDefaultFilterState();
        state.keyword.enabled = true;
        state.keyword.text = '   ';
        expect(
            matchesPlayerFilters(makeRow({ displayName: 'anything' }), state)
        ).toBe(true);
    });
});

describe('matchesPlayerFilters — groups', () => {
    const groupA = 'grp_00000000-0000-0000-0000-0000000000a1';
    const groupB = 'grp_00000000-0000-0000-0000-0000000000b2';

    test('AND combine requires all conditions', () => {
        const state = createDefaultFilterState();
        state.groups.enabled = true;
        state.groups.combine = 'AND';
        state.groups.conditions = [
            { groupId: groupA, joined: true },
            { groupId: groupB, joined: true }
        ];
        expect(
            matchesPlayerFilters(makeRow({ groupOnNameplate: groupA }), state)
        ).toBe(false);
        expect(
            matchesPlayerFilters(makeRow({ groupOnNameplate: groupB }), state)
        ).toBe(false);
        expect(
            matchesPlayerFilters(makeRow({ groupOnNameplate: '' }), state)
        ).toBe(false);
    });

    test('OR combine passes when any condition matches', () => {
        const state = createDefaultFilterState();
        state.groups.enabled = true;
        state.groups.combine = 'OR';
        state.groups.conditions = [
            { groupId: groupA, joined: true },
            { groupId: groupB, joined: true }
        ];
        expect(
            matchesPlayerFilters(makeRow({ groupOnNameplate: groupA }), state)
        ).toBe(true);
        expect(
            matchesPlayerFilters(makeRow({ groupOnNameplate: groupB }), state)
        ).toBe(true);
        expect(
            matchesPlayerFilters(makeRow({ groupOnNameplate: '' }), state)
        ).toBe(false);
    });

    test('"not joined" condition inverts the match', () => {
        const state = createDefaultFilterState();
        state.groups.enabled = true;
        state.groups.combine = 'AND';
        state.groups.conditions = [{ groupId: groupA, joined: false }];
        expect(
            matchesPlayerFilters(makeRow({ groupOnNameplate: groupA }), state)
        ).toBe(false);
        expect(
            matchesPlayerFilters(makeRow({ groupOnNameplate: groupB }), state)
        ).toBe(true);
        expect(
            matchesPlayerFilters(makeRow({ groupOnNameplate: '' }), state)
        ).toBe(true);
    });

    test('ignores conditions without a groupId', () => {
        const state = createDefaultFilterState();
        state.groups.enabled = true;
        state.groups.conditions = [
            { groupId: '', joined: true },
            { groupId: groupA, joined: true }
        ];
        expect(
            matchesPlayerFilters(makeRow({ groupOnNameplate: groupA }), state)
        ).toBe(true);
    });

    test('uses runtime.playerGroupMap to determine joined groups', () => {
        const state = createDefaultFilterState();
        state.groups.enabled = true;
        state.groups.combine = 'AND';
        state.groups.conditions = [{ groupId: groupA, joined: true }];
        const runtime = makeRuntime({
            playerGroupMap: new Map([
                ['usr_joined', new Set([groupA])],
                ['usr_other_group', new Set([groupB])],
                ['usr_no_groups', new Set()]
            ])
        });
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_joined' } }),
                state,
                runtime
            )
        ).toBe(true);
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_other_group' } }),
                state,
                runtime
            )
        ).toBe(false);
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_no_groups' } }),
                state,
                runtime
            )
        ).toBe(false);
    });

    test('"not joined" inverts when using runtime.playerGroupMap', () => {
        const state = createDefaultFilterState();
        state.groups.enabled = true;
        state.groups.combine = 'AND';
        state.groups.conditions = [{ groupId: groupA, joined: false }];
        const runtime = makeRuntime({
            playerGroupMap: new Map([
                ['usr_joined', new Set([groupA])],
                ['usr_not_joined', new Set([groupB])]
            ])
        });
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_joined' } }),
                state,
                runtime
            )
        ).toBe(false);
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_not_joined' } }),
                state,
                runtime
            )
        ).toBe(true);
    });

    test('falls back to groupOnNameplate when playerGroupMap has no entry', () => {
        const state = createDefaultFilterState();
        state.groups.enabled = true;
        state.groups.combine = 'OR';
        state.groups.conditions = [{ groupId: groupA, joined: true }];
        const runtime = makeRuntime({
            playerGroupMap: new Map([['usr_other', new Set([groupB])]])
        });
        expect(
            matchesPlayerFilters(
                makeRow({
                    ref: { id: 'usr_unknown' },
                    groupOnNameplate: groupA
                }),
                state,
                runtime
            )
        ).toBe(true);
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_unknown' }, groupOnNameplate: '' }),
                state,
                runtime
            )
        ).toBe(false);
    });
});

describe('matchesPlayerFilters — mutual', () => {
    test('requires at least one mutual friend', () => {
        const state = createDefaultFilterState();
        state.mutual.enabled = true;
        const runtime = makeRuntime({
            mutualSnapshot: new Map([
                ['usr_a', ['usr_b']],
                ['usr_none', []]
            ])
        });
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_a' } }),
                state,
                runtime
            )
        ).toBe(true);
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_none' } }),
                state,
                runtime
            )
        ).toBe(false);
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_missing' } }),
                state,
                runtime
            )
        ).toBe(false);
    });

    test('with a target, requires that specific mutual friend', () => {
        const state = createDefaultFilterState();
        state.mutual.enabled = true;
        state.mutual.targetUserId = 'usr_b';
        const runtime = makeRuntime({
            mutualSnapshot: new Map([
                ['usr_a', ['usr_b', 'usr_c']],
                ['usr_d', ['usr_c']]
            ])
        });
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_a' } }),
                state,
                runtime
            )
        ).toBe(true);
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_d' } }),
                state,
                runtime
            )
        ).toBe(false);
    });
});

describe('matchesPlayerFilters — platform', () => {
    test('maps platform values to keys', () => {
        const state = createDefaultFilterState();
        state.platform.enabled = true;
        state.platform.platforms.pc = true;
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'a', $platform: 'standalonewindows' } }),
                state
            )
        ).toBe(true);
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'a', $platform: 'android' } }),
                state
            )
        ).toBe(false);
    });

    test('treats missing/unknown platform as unknown', () => {
        const state = createDefaultFilterState();
        state.platform.enabled = true;
        state.platform.platforms.unknown = true;
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'a', $platform: undefined } }),
                state
            )
        ).toBe(true);
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'a', $platform: 'quest-link' } }),
                state
            )
        ).toBe(true);
    });
});

describe('matchesPlayerFilters — room history', () => {
    const baseStats = new Map([
        [
            'usr_a',
            {
                firstJoin: 1_000,
                joinCount: 3,
                totalTime: 300_000
            }
        ]
    ]);

    test('firstJoin within range', () => {
        // Build expected timestamps from the same local-time parsing the filter uses
        const from = new Date('1970-01-01T00:00:01').getTime();

        const state = createDefaultFilterState();
        state.roomHistory.enabled = true;
        state.roomHistory.firstJoin.enabled = true;
        state.roomHistory.firstJoin.from = '1970-01-01T00:00:01';
        state.roomHistory.firstJoin.to = '1970-01-01T00:00:02';

        const inRange = makeRuntime({
            roomPlayerStats: new Map([
                ['usr_a', { firstJoin: from + 1, joinCount: 0, totalTime: 0 }]
            ])
        });
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_a' }, timer: 0 }),
                state,
                inRange
            )
        ).toBe(true);

        const belowRange = makeRuntime({
            roomPlayerStats: new Map([
                ['usr_a', { firstJoin: from - 1, joinCount: 0, totalTime: 0 }]
            ])
        });
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_a' }, timer: 0 }),
                state,
                belowRange
            )
        ).toBe(false);
    });

    test('firstJoin takes the min of stats and current-session timer', () => {
        const to = new Date('2026-07-01T00:00:00.800').getTime();
        const state = createDefaultFilterState();
        state.roomHistory.enabled = true;
        state.roomHistory.firstJoin.enabled = true;
        state.roomHistory.firstJoin.to = '2026-07-01T00:00:00.800';
        const runtime = makeRuntime({
            roomPlayerStats: new Map([
                ['usr_a', { firstJoin: to + 200, joinCount: 0, totalTime: 0 }]
            ]),
            now: to + 100_000
        });
        // timer earlier than recorded firstJoin -> min wins (to < to + 200)
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_a' }, timer: to }),
                state,
                runtime
            )
        ).toBe(true);
    });

    test('firstJoin enabled but no data at all fails', () => {
        const state = createDefaultFilterState();
        state.roomHistory.enabled = true;
        state.roomHistory.firstJoin.enabled = true;
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_x' }, timer: 0 }),
                state,
                makeRuntime()
            )
        ).toBe(false);
    });

    test('sessionCount comparisons', () => {
        const runtime = makeRuntime({ roomPlayerStats: baseStats });

        const gte = createDefaultFilterState();
        gte.roomHistory.enabled = true;
        gte.roomHistory.sessionCount.enabled = true;
        gte.roomHistory.sessionCount.comparison = 'gte';
        gte.roomHistory.sessionCount.count = 3;
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_a' }, timer: 0 }),
                gte,
                runtime
            )
        ).toBe(true);

        const eq = createDefaultFilterState();
        eq.roomHistory.enabled = true;
        eq.roomHistory.sessionCount.enabled = true;
        eq.roomHistory.sessionCount.comparison = 'eq';
        eq.roomHistory.sessionCount.count = 2;
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_a' }, timer: 0 }),
                eq,
                runtime
            )
        ).toBe(false);

        const lte = createDefaultFilterState();
        lte.roomHistory.enabled = true;
        lte.roomHistory.sessionCount.enabled = true;
        lte.roomHistory.sessionCount.comparison = 'lte';
        lte.roomHistory.sessionCount.count = 2;
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_a' }, timer: 0 }),
                lte,
                runtime
            )
        ).toBe(false);
    });

    test('sessionCount falls back to 1 for a present player with no stats', () => {
        const state = createDefaultFilterState();
        state.roomHistory.enabled = true;
        state.roomHistory.sessionCount.enabled = true;
        state.roomHistory.sessionCount.comparison = 'eq';
        state.roomHistory.sessionCount.count = 1;
        const runtime = makeRuntime();
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_x' }, timer: 50_000 }),
                state,
                runtime
            )
        ).toBe(true);
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_x' }, timer: 0 }),
                state,
                runtime
            )
        ).toBe(false);
    });

    test('onlineDuration min/max including current session time', () => {
        const state = createDefaultFilterState();
        state.roomHistory.enabled = true;
        state.roomHistory.onlineDuration.enabled = true;
        // totalTime = 300_000 (stats) + (now 1_000_000 - timer 800_000) = 500_000 ms = ~8.33 min
        const runtime = makeRuntime({
            roomPlayerStats: baseStats,
            now: 1_000_000
        });
        state.roomHistory.onlineDuration.minMinutes = 8;
        state.roomHistory.onlineDuration.maxMinutes = 9;
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_a' }, timer: 800_000 }),
                state,
                runtime
            )
        ).toBe(true);
        state.roomHistory.onlineDuration.maxMinutes = 8;
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_a' }, timer: 800_000 }),
                state,
                runtime
            )
        ).toBe(false);
    });

    test('onlineDuration with no data at all fails', () => {
        const state = createDefaultFilterState();
        state.roomHistory.enabled = true;
        state.roomHistory.onlineDuration.enabled = true;
        state.roomHistory.onlineDuration.minMinutes = 1;
        expect(
            matchesPlayerFilters(
                makeRow({ ref: { id: 'usr_x' }, timer: 0 }),
                state,
                makeRuntime()
            )
        ).toBe(false);
    });
});

describe('matchesPlayerFilters — groups AND semantics', () => {
    test('enabled groups are AND-ed together', () => {
        const state = createDefaultFilterState();
        state.relationship.enabled = true;
        state.relationship.friends = true;
        state.keyword.enabled = true;
        state.keyword.text = 'alice';
        const row = makeRow({ displayName: 'Alice', isFriend: true });
        expect(matchesPlayerFilters(row, state)).toBe(true);
        expect(
            matchesPlayerFilters(
                makeRow({ displayName: 'Alice', isFriend: false }),
                state
            )
        ).toBe(false);
    });
});
