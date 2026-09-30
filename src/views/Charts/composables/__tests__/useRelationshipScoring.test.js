import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    ensureUserContext: vi.fn(),
    getFriendshipMetrics: vi.fn(),
    configStore: new Map()
}));

vi.mock('../../../../stores', () => ({
    useUserStore: () => ({ currentUser: { id: 'user-self' } })
}));

vi.mock('../../../../services/database', () => ({
    database: {
        ensureUserContext: mocks.ensureUserContext,
        getFriendshipMetrics: mocks.getFriendshipMetrics
    }
}));

vi.mock('../../../../services/config', () => {
    const store = mocks.configStore;
    return {
        default: {
            getObject: async (key, defaultValue = null) =>
                store.has(`object:${key}`) ? store.get(`object:${key}`) : defaultValue,
            setObject: async (key, value) => {
                store.set(`object:${key}`, value);
            },
            getArray: async (key, defaultValue = null) =>
                store.has(`array:${key}`) ? store.get(`array:${key}`) : defaultValue,
            setArray: async (key, value) => {
                store.set(`array:${key}`, value);
            },
            getString: async (key, defaultValue = null) =>
                store.has(`string:${key}`) ? store.get(`string:${key}`) : defaultValue,
            setString: async (key, value) => {
                store.set(`string:${key}`, value);
            }
        }
    };
});

import { useRelationshipScoring } from '../useRelationshipScoring';

function metric(overrides = {}) {
    return {
        userId: 'friend',
        displayName: 'Friend',
        totalTime: 0,
        joinCount: 0,
        distinctDays: 0,
        firstSeen: null,
        lastSeen: null,
        ...overrides
    };
}

async function loadWith(metrics) {
    mocks.ensureUserContext.mockResolvedValue(true);
    mocks.getFriendshipMetrics.mockResolvedValue(metrics);
    const scoring = useRelationshipScoring();
    await scoring.loadScores();
    return scoring;
}

beforeEach(() => {
    mocks.ensureUserContext.mockReset();
    mocks.getFriendshipMetrics.mockReset();
    mocks.configStore.clear();
});

describe('useRelationshipScoring', () => {
    it('returns empty results for empty metrics', async () => {
        const scoring = await loadWith([]);
        expect(scoring.friendScores.value.size).toBe(0);
        expect(scoring.topFriends.value).toEqual([]);
    });

    it('gives a single friend full dimensions', async () => {
        const scoring = await loadWith([
            metric({
                userId: 'only',
                totalTime: 5000,
                joinCount: 3,
                distinctDays: 2,
                lastSeen: new Date().toISOString()
            })
        ]);
        const entry = scoring.friendScores.value.get('only');
        expect(entry.dimensions.onlineOverlap).toBe(100);
        expect(entry.dimensions.coWorldFrequency).toBe(100);
        expect(entry.dimensions.consistency).toBe(100);
        expect(entry.dimensions.recency).toBe(100);
        expect(entry.score).toBe(100);
    });

    it('scores all-zero metrics as zero on log-normalized dimensions', async () => {
        const now = new Date().toISOString();
        const scoring = await loadWith([
            metric({ userId: 'a', lastSeen: now }),
            metric({ userId: 'b', lastSeen: now })
        ]);
        for (const id of ['a', 'b']) {
            const entry = scoring.friendScores.value.get(id);
            expect(entry.dimensions.onlineOverlap).toBe(0);
            expect(entry.dimensions.coWorldFrequency).toBe(0);
            expect(entry.dimensions.consistency).toBe(0);
            expect(entry.score).toBe(20);
        }
    });

    it('does not let an outlier friend flatten the others', async () => {
        const now = new Date().toISOString();
        const metrics = [];
        for (let i = 0; i < 9; i++) {
            metrics.push(
                metric({
                    userId: `normal-${i}`,
                    totalTime: i + 1,
                    joinCount: 1,
                    distinctDays: 1,
                    lastSeen: now
                })
            );
        }
        metrics.push(
            metric({
                userId: 'whale',
                totalTime: 1e9,
                joinCount: 1,
                distinctDays: 1,
                lastSeen: now
            })
        );
        const scoring = await loadWith(metrics);

        // Old max-normalization gave friend totalTime=1 a score of 0 here.
        const smallest = scoring.friendScores.value.get('normal-0');
        expect(smallest.dimensions.onlineOverlap).toBeGreaterThanOrEqual(29);
        expect(smallest.dimensions.onlineOverlap).toBeLessThanOrEqual(31);

        // Values below the p90 reference keep their relative order.
        const fourth = scoring.friendScores.value.get('normal-3');
        expect(fourth.dimensions.onlineOverlap).toBeGreaterThan(
            smallest.dimensions.onlineOverlap
        );

        // The whale is capped at the reference, not stretched past it.
        const whale = scoring.friendScores.value.get('whale');
        expect(whale.dimensions.onlineOverlap).toBe(100);
    });

    it('decays recency over 90 days', async () => {
        const lastSeen = new Date(
            Date.now() - 90 * 24 * 60 * 60 * 1000
        ).toISOString();
        const scoring = await loadWith([
            metric({ userId: 'stale', totalTime: 1, lastSeen })
        ]);
        const entry = scoring.friendScores.value.get('stale');
        expect(entry.dimensions.recency).toBeGreaterThanOrEqual(36);
        expect(entry.dimensions.recency).toBeLessThanOrEqual(38);
    });
});

describe('useRelationshipScoring weights', () => {
    const recencyOnlyFixture = () => [
        metric({ userId: 'fresh', lastSeen: new Date().toISOString() })
    ];

    it('recomputes scores from custom weights', async () => {
        const scoring = await loadWith(recencyOnlyFixture());
        expect(scoring.friendScores.value.get('fresh').score).toBe(20);

        scoring.setWeight('onlineOverlap', 0);
        scoring.setWeight('coWorldFrequency', 0);
        scoring.setWeight('consistency', 0);
        scoring.setWeight('recency', 100);
        expect(scoring.friendScores.value.get('fresh').score).toBe(100);

        scoring.resetWeights();
        expect(scoring.friendScores.value.get('fresh').score).toBe(20);
    });

    it('scores zero when every weight is zero', async () => {
        const scoring = await loadWith(recencyOnlyFixture());
        scoring.setWeight('onlineOverlap', 0);
        scoring.setWeight('coWorldFrequency', 0);
        scoring.setWeight('recency', 0);
        scoring.setWeight('consistency', 0);
        expect(scoring.friendScores.value.get('fresh').score).toBe(0);
    });
});

describe('useRelationshipScoring exclusions', () => {
    // N=9 puts the nearest-rank p90 index on the whale, so its presence
    // actually moves the reference value for every other friend.
    function outlierFixture() {
        const now = new Date().toISOString();
        const metrics = [];
        for (let i = 0; i < 8; i++) {
            metrics.push(
                metric({
                    userId: `normal-${i}`,
                    displayName: `Normal ${i}`,
                    totalTime: i + 1,
                    joinCount: 1,
                    distinctDays: 1,
                    lastSeen: now
                })
            );
        }
        metrics.push(
            metric({
                userId: 'whale',
                displayName: 'Whale',
                totalTime: 1e9,
                joinCount: 1,
                distinctDays: 1,
                lastSeen: now
            })
        );
        return metrics;
    }

    it('full exclusion removes the friend from scoring and raises others', async () => {
        const scoring = await loadWith(outlierFixture());
        expect(
            scoring.friendScores.value.get('normal-0').dimensions.onlineOverlap
        ).toBeLessThanOrEqual(5);

        scoring.excludeFriend('whale');

        expect(scoring.excludeMode.value).toBe('full');
        expect(scoring.friendScores.value.has('whale')).toBe(false);
        expect(
            scoring.topFriends.value.some((f) => f.userId === 'whale')
        ).toBe(false);
        expect(
            scoring.friendScores.value.get('normal-0').dimensions.onlineOverlap
        ).toBeGreaterThanOrEqual(25);
        expect(scoring.excludedFriends.value).toEqual([
            { userId: 'whale', displayName: 'Whale' }
        ]);

        scoring.includeFriend('whale');
        expect(scoring.friendScores.value.has('whale')).toBe(true);
        expect(scoring.excludedFriends.value).toEqual([]);
    });

    it('hidden exclusion keeps scores intact but hides from the list', async () => {
        const scoring = await loadWith(outlierFixture());
        scoring.setExcludeMode('hidden');
        scoring.excludeFriend('whale');

        expect(scoring.friendScores.value.has('whale')).toBe(true);
        expect(
            scoring.topFriends.value.some((f) => f.userId === 'whale')
        ).toBe(false);
        // The whale still shapes the p90 reference, so the smallest friend
        // stays compressed instead of jumping up as in full exclusion.
        expect(
            scoring.friendScores.value.get('normal-0').dimensions.onlineOverlap
        ).toBeLessThanOrEqual(5);
    });

    it('excludes hidden friends from the distribution display', async () => {
        const scoring = await loadWith(outlierFixture());
        scoring.setExcludeMode('hidden');
        const before = scoring.scoreDistribution.value.reduce(
            (s, b) => s + b.count,
            0
        );
        scoring.excludeFriend('whale');
        const after = scoring.scoreDistribution.value.reduce(
            (s, b) => s + b.count,
            0
        );
        expect(after).toBe(before - 1);
    });
});

describe('useRelationshipScoring preference persistence', () => {
    it('restores weights, exclusions, and mode on a new instance', async () => {
        const metrics = [
            metric({ userId: 'a', displayName: 'A', lastSeen: new Date().toISOString() }),
            metric({ userId: 'b', displayName: 'B', lastSeen: new Date().toISOString() })
        ];

        const first = await loadWith(metrics);
        first.setWeight('recency', 55);
        first.excludeFriend('b');
        first.setExcludeMode('hidden');

        const second = await loadWith(metrics);
        expect(second.weights.value.recency).toBe(55);
        expect(second.excludedUserIds.value).toEqual(['b']);
        expect(second.excludeMode.value).toBe('hidden');
        expect(
            second.topFriends.value.some((f) => f.userId === 'b')
        ).toBe(false);
    });
});
