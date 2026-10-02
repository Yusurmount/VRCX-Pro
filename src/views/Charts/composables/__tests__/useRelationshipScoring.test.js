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
        // Two-term decay: 0.6·e^(-90/14) + 0.4·e^(-90/120) ≈ 19.
        expect(entry.dimensions.recency).toBeGreaterThanOrEqual(18);
        expect(entry.dimensions.recency).toBeLessThanOrEqual(20);
    });

    it('returns every non-excluded friend instead of capping the list', async () => {
        const now = new Date().toISOString();
        const metrics = Array.from({ length: 25 }, (_, i) =>
            metric({
                userId: `friend-${i}`,
                displayName: `Friend ${i}`,
                totalTime: (i + 1) * 1000,
                lastSeen: now
            })
        );
        const scoring = await loadWith(metrics);

        const scores = scoring.topFriends.value.map((friend) => friend.score);
        expect(scores).toHaveLength(25);
        for (let i = 1; i < scores.length; i++) {
            expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
        }
    });
});

describe('useRelationshipScoring recency', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const daysAgo = (days) =>
        new Date(Date.now() - days * DAY).toISOString();

    it('separates a week from a month far more than the old curve did', async () => {
        const scoring = await loadWith([
            metric({ userId: 'week', lastSeen: daysAgo(7) }),
            metric({ userId: 'month', lastSeen: daysAgo(30) })
        ]);
        const week = scoring.friendScores.value.get('week').dimensions.recency;
        const month = scoring.friendScores.value.get('month').dimensions.recency;
        // Old curve: 92 vs 72 (gap of 20). New: ~74 vs ~38.
        expect(week).toBeGreaterThanOrEqual(70);
        expect(week).toBeLessThanOrEqual(77);
        expect(month).toBeGreaterThanOrEqual(35);
        expect(month).toBeLessThanOrEqual(41);
        expect(week - month).toBeGreaterThanOrEqual(30);
    });

    it('scores a regular contact above a one-off encounter seen just as recently', async () => {
        const scoring = await loadWith([
            metric({
                userId: 'regular',
                lastSeen: daysAgo(7),
                firstSeen: daysAgo(60),
                distinctDays: 20
            }),
            metric({
                userId: 'oneoff',
                lastSeen: daysAgo(7),
                firstSeen: daysAgo(60),
                distinctDays: 1
            })
        ]);
        const regular =
            scoring.friendScores.value.get('regular').dimensions.recency;
        const oneoff =
            scoring.friendScores.value.get('oneoff').dimensions.recency;
        expect(regular).toBeGreaterThanOrEqual(70);
        expect(oneoff).toBeLessThanOrEqual(48);
        expect(regular - oneoff).toBeGreaterThanOrEqual(25);
    });

    it('stops discounting once contact density reaches the reference', async () => {
        const scoring = await loadWith([
            metric({
                userId: 'dense',
                lastSeen: new Date().toISOString(),
                firstSeen: daysAgo(30),
                distinctDays: 4
            })
        ]);
        expect(
            scoring.friendScores.value.get('dense').dimensions.recency
        ).toBe(100);
    });

    it('keeps a missing firstSeen unpunished', async () => {
        const scoring = await loadWith([
            metric({ userId: 'legacy', lastSeen: new Date().toISOString() })
        ]);
        expect(
            scoring.friendScores.value.get('legacy').dimensions.recency
        ).toBe(100);
    });

    it('clamps a future lastSeen to full marks instead of exceeding 100', async () => {
        const scoring = await loadWith([
            metric({ userId: 'clock-skew', lastSeen: daysAgo(-10) })
        ]);
        const entry = scoring.friendScores.value.get('clock-skew');
        expect(entry.dimensions.recency).toBe(100);
        expect(entry.score).toBeLessThanOrEqual(100);
    });

    it('scores an unparsable lastSeen as zero without leaking NaN', async () => {
        const scoring = await loadWith([
            metric({ userId: 'broken', lastSeen: 'not-a-timestamp' }),
            metric({ userId: 'fine', lastSeen: new Date().toISOString() })
        ]);
        const broken = scoring.friendScores.value.get('broken');
        expect(broken.dimensions.recency).toBe(0);
        expect(Number.isFinite(broken.score)).toBe(true);
        expect(Number.isFinite(scoring.friendScores.value.get('fine').score)).toBe(
            true
        );
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

    it('restores every excluded friend at once', async () => {
        const scoring = await loadWith(outlierFixture());
        scoring.excludeFriend('whale');
        scoring.excludeFriend('normal-0');
        expect(scoring.excludedUserIds.value).toHaveLength(2);

        scoring.includeAllFriends();

        expect(scoring.excludedUserIds.value).toEqual([]);
        expect(scoring.excludedFriends.value).toEqual([]);
        expect(scoring.topFriends.value.some((f) => f.userId === 'whale')).toBe(
            true
        );
        expect(
            mocks.configStore.get('array:intimacyExcludedFriends')
        ).toEqual([]);

        const second = await loadWith(outlierFixture());
        expect(second.excludedUserIds.value).toEqual([]);
    });
});

describe('useRelationshipScoring score mode', () => {
    const HOURS = 60 * 60 * 1000;

    function friendFixture() {
        return metric({
            userId: 'a',
            displayName: 'A',
            totalTime: 100 * HOURS,
            joinCount: 20,
            distinctDays: 30,
            lastSeen: new Date().toISOString()
        });
    }

    function whaleFixture() {
        return metric({
            userId: 'whale',
            displayName: 'Whale',
            totalTime: 1e12,
            joinCount: 1e6,
            distinctDays: 1e6,
            lastSeen: new Date().toISOString()
        });
    }

    it('defaults to percent on a 0-100 scale', async () => {
        const scoring = await loadWith([friendFixture()]);
        expect(scoring.scoreMode.value).toBe('percent');
        expect(scoring.scoreMax.value).toBe(100);
        expect(scoring.friendScores.value.get('a').score).toBe(100);
        expect(scoring.scoreDistribution.value[0].range).toBe('0-10');
        expect(scoring.scoreDistribution.value[9].range).toBe('90-100');
    });

    it('scores absolute mode uncapped and to one decimal', async () => {
        const scoring = await loadWith([friendFixture(), whaleFixture()]);
        scoring.setScoreMode('absolute');

        expect(scoring.scoreMode.value).toBe('absolute');

        const friend = scoring.friendScores.value.get('a');
        const whale = scoring.friendScores.value.get('whale');

        // The whale sits far past the anchors, so nothing clamps to the scale.
        expect(whale.dimensions.onlineOverlap).toBeGreaterThan(1000);
        expect(whale.score).toBeGreaterThan(1000);

        for (const entry of [friend, whale]) {
            expect(entry.score).toBe(Math.round(entry.score * 10) / 10);
            for (const value of Object.values(entry.dimensions)) {
                expect(value).toBe(Math.round(value * 10) / 10);
            }
        }

        // The best score is the full mark behind every progress bar.
        expect(scoring.scoreMax.value).toBe(scoring.topFriends.value[0].score);
        expect(scoring.scoreMax.value).toBe(whale.score);

        const step = Math.ceil(scoring.scoreMax.value / 10);
        const distribution = scoring.scoreDistribution.value;
        expect(distribution[0].range).toBe(`0-${step}`);
        expect(distribution[9].range).toBe(`${9 * step}-${10 * step}`);
    });

    it('keeps absolute scores stable when the cohort changes', async () => {
        const friend = friendFixture();

        const alone = await loadWith([friend]);
        alone.setScoreMode('absolute');
        const aloneScore = alone.friendScores.value.get('a').score;

        const withWhale = await loadWith([friend, whaleFixture()]);
        withWhale.setScoreMode('absolute');
        expect(withWhale.friendScores.value.get('a').score).toBe(aloneScore);
    });

    it('still moves percent scores with the cohort', async () => {
        const friend = friendFixture();

        const alone = await loadWith([friend]);
        const aloneScore = alone.friendScores.value.get('a').score;

        const withWhale = await loadWith([friend, whaleFixture()]);
        expect(withWhale.friendScores.value.get('a').score).toBeLessThan(
            aloneScore
        );
    });

    it('rejects unknown score modes', async () => {
        const scoring = await loadWith([friendFixture()]);
        scoring.setScoreMode('bogus');
        expect(scoring.scoreMode.value).toBe('percent');
    });

    it('restores the score mode on a new instance', async () => {
        const first = await loadWith([friendFixture()]);
        first.setScoreMode('absolute');

        const second = await loadWith([friendFixture()]);
        expect(second.scoreMode.value).toBe('absolute');
        expect(second.scoreMax.value).toBe(
            second.friendScores.value.get('a').score
        );
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
