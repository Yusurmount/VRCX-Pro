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

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function metric(overrides = {}) {
    return {
        userId: 'friend',
        displayName: 'Friend',
        totalTime: 0,
        joinCount: 0,
        distinctDays: 0,
        firstSeen: null,
        lastSeen: null,
        activeWeeks: 0,
        time30d: 0,
        timePrev30d: 0,
        time90d: 0,
        friendNumber: 0,
        friendInitiated: 0,
        selfInitiated: 0,
        ...overrides
    };
}

async function loadWith(metrics, { afterLoad } = {}) {
    mocks.ensureUserContext.mockResolvedValue(true);
    mocks.getFriendshipMetrics.mockResolvedValue(metrics);
    const scoring = useRelationshipScoring();
    await scoring.loadScores();
    if (afterLoad) afterLoad(scoring);
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

    it('gives a single fully-evidenced friend full marks', async () => {
        const now = new Date().toISOString();
        const scoring = await loadWith([
            metric({
                userId: 'only',
                totalTime: 100 * HOUR,
                joinCount: 40,
                distinctDays: 30,
                firstSeen: new Date(Date.now() - 60 * DAY).toISOString(),
                lastSeen: now,
                activeWeeks: 8,
                time30d: 60 * HOUR,
                timePrev30d: 0,
                time90d: 100 * HOUR,
                friendInitiated: 5,
                selfInitiated: 0
            })
        ]);
        const entry = scoring.friendScores.value.get('only');
        expect(entry.dimensions.contact).toBe(100);
        expect(entry.dimensions.regularity).toBe(100);
        expect(entry.dimensions.recency).toBe(100);
        expect(entry.dimensions.trend).toBe(100);
        expect(entry.dimensions.activity).toBe(100);
        expect(entry.score).toBe(100);
    });

    it('scores a friend with no volume evidence near zero', async () => {
        const now = new Date().toISOString();
        const scoring = await loadWith([
            metric({
                userId: 'hollow',
                firstSeen: new Date(Date.now() - 40 * DAY).toISOString(),
                lastSeen: now
            })
        ]);
        const entry = scoring.friendScores.value.get('hollow');
        expect(entry.dimensions.contact).toBe(0);
        expect(entry.dimensions.regularity).toBe(0);
        expect(entry.score).toBeLessThan(40);
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

        // log1p + p90 on hours keeps the smallest friend positive but far
        // below the whale — no flattening to zero, no ceiling either.
        const smallest = scoring.friendScores.value.get('normal-0');
        expect(smallest.dimensions.contact).toBeGreaterThan(0);
        expect(smallest.dimensions.contact).toBeLessThan(30);

        const fourth = scoring.friendScores.value.get('normal-3');
        expect(fourth.dimensions.contact).toBeGreaterThan(
            smallest.dimensions.contact
        );

        const whale = scoring.friendScores.value.get('whale');
        expect(whale.dimensions.contact).toBe(100);
    });

    it('keeps a fragmented hangout from being crushed by session depth', async () => {
        const now = new Date().toISOString();
        // 20 hours together across 100 reconnect fragments: depth is tiny,
        // so coherence must freeze structure instead of destroying the score.
        const scoring = await loadWith([
            metric({
                userId: 'fragmented',
                totalTime: 20 * HOUR,
                joinCount: 100,
                firstSeen: new Date(Date.now() - 30 * DAY).toISOString(),
                lastSeen: now,
                activeWeeks: 4,
                time90d: 20 * HOUR,
                time30d: 20 * HOUR
            })
        ]);
        const entry = scoring.friendScores.value.get('fragmented');
        expect(entry.dimensions.contact).toBe(100);
        expect(entry.score).toBeGreaterThan(60);
    });

    it('lets a deep single session outscore a same-time fragmented one', async () => {
        const now = new Date().toISOString();
        const base = {
            firstSeen: new Date(Date.now() - 60 * DAY).toISOString(),
            lastSeen: now,
            distinctDays: 6,
            activeWeeks: 6
        };
        const scoring = await loadWith([
            metric({
                userId: 'deep',
                totalTime: 12 * HOUR,
                joinCount: 4,
                ...base
            }),
            metric({
                userId: 'choppy',
                totalTime: 12 * HOUR,
                joinCount: 120,
                ...base
            })
        ]);
        const deep = scoring.friendScores.value.get('deep');
        const choppy = scoring.friendScores.value.get('choppy');
        expect(deep.dimensions.contact).toBeGreaterThan(
            choppy.dimensions.contact
        );
    });

    it('separates a barely-different cohort on the percent scale', async () => {
        // Nine friends at 1 active week and one at 2: p90 log-normalization
        // pinned everyone at 100 because the reference landed on the mode.
        const now = new Date().toISOString();
        const metrics = Array.from({ length: 9 }, (_, i) =>
            metric({ userId: `w1-${i}`, activeWeeks: 1, lastSeen: now })
        );
        metrics.push(metric({ userId: 'w2', activeWeeks: 2, lastSeen: now }));
        const scoring = await loadWith(metrics);
        expect(
            scoring.friendScores.value.get('w1-0').dimensions.regularity
        ).toBeLessThan(100);
        expect(scoring.friendScores.value.get('w1-0').dimensions.regularity).toBe(90);
        expect(
            scoring.friendScores.value.get('w2').dimensions.regularity
        ).toBe(100);
    });

    it('reads a perfectly homogeneous cohort as full marks', async () => {
        const now = new Date().toISOString();
        const metrics = Array.from({ length: 5 }, (_, i) =>
            metric({ userId: `same-${i}`, activeWeeks: 3, lastSeen: now })
        );
        const scoring = await loadWith(metrics);
        for (const id of ['same-0', 'same-4']) {
            expect(
                scoring.friendScores.value.get(id).dimensions.regularity
            ).toBe(100);
        }
    });

    it('keeps a zero observation at zero instead of riding a tie upward', async () => {
        const now = new Date().toISOString();
        const scoring = await loadWith([
            metric({ userId: 'none', activeWeeks: 0, lastSeen: now }),
            metric({ userId: 'some', activeWeeks: 5, lastSeen: now })
        ]);
        expect(
            scoring.friendScores.value.get('none').dimensions.regularity
        ).toBe(0);
        expect(
            scoring.friendScores.value.get('some').dimensions.regularity
        ).toBe(100);
    });
});

describe('useRelationshipScoring recency and regularity', () => {
    const daysAgo = (days) => new Date(Date.now() - days * DAY).toISOString();

    it('scores no rolling-window volume as zero recency', async () => {
        const scoring = await loadWith([
            metric({ userId: 'stale', totalTime: 1, lastSeen: daysAgo(200) })
        ]);
        const entry = scoring.friendScores.value.get('stale');
        // Beyond 90 days there is no time90d left to modulate — zero volume
        // reads as zero recency regardless of the decay curve's long tail.
        expect(entry.dimensions.recency).toBe(0);
    });

    it('modulates rolling-window volume by how long ago it happened', async () => {
        const scoring = await loadWith([
            metric({
                userId: 'week',
                lastSeen: daysAgo(7),
                time90d: 2 * HOUR
            }),
            metric({
                userId: 'month',
                lastSeen: daysAgo(30),
                time90d: 2 * HOUR
            })
        ]);
        const week = scoring.friendScores.value.get('week').dimensions.recency;
        const month = scoring.friendScores.value.get('month').dimensions.recency;
        // Same volume, different freshness: 0.74 vs 0.38 of the anchor score.
        expect(week).toBeGreaterThanOrEqual(70);
        expect(week).toBeLessThanOrEqual(77);
        expect(month).toBeGreaterThanOrEqual(35);
        expect(month).toBeLessThanOrEqual(41);
        expect(week - month).toBeGreaterThanOrEqual(30);
    });

    it('ranks accumulated active weeks as regularity, not recency', async () => {
        const scoring = await loadWith([
            metric({
                userId: 'regular',
                lastSeen: daysAgo(7),
                firstSeen: daysAgo(60),
                distinctDays: 20,
                activeWeeks: 8
            }),
            metric({
                userId: 'oneoff',
                lastSeen: daysAgo(7),
                firstSeen: daysAgo(60),
                distinctDays: 1,
                activeWeeks: 1
            })
        ]);
        const regular = scoring.friendScores.value.get('regular');
        const oneoff = scoring.friendScores.value.get('oneoff');
        expect(regular.dimensions.regularity).toBeGreaterThanOrEqual(90);
        expect(oneoff.dimensions.regularity).toBeLessThanOrEqual(60);
        // The difference lives entirely in regularity now.
        expect(regular.dimensions.recency).toBe(oneoff.dimensions.recency);
    });

    it('does not depend on firstSeen — active weeks alone carry it', async () => {
        const scoring = await loadWith([
            metric({
                userId: 'no-first',
                lastSeen: new Date().toISOString(),
                activeWeeks: 6
            }),
            metric({
                userId: 'has-first',
                lastSeen: new Date().toISOString(),
                firstSeen: daysAgo(60),
                activeWeeks: 6
            })
        ]);
        expect(
            scoring.friendScores.value.get('no-first').dimensions.regularity
        ).toBe(
            scoring.friendScores.value.get('has-first').dimensions.regularity
        );
    });

    it('clamps a future lastSeen to full marks instead of exceeding 100', async () => {
        const scoring = await loadWith([
            metric({
                userId: 'clock-skew',
                lastSeen: daysAgo(-10),
                time90d: 2 * HOUR
            })
        ]);
        const entry = scoring.friendScores.value.get('clock-skew');
        expect(entry.dimensions.recency).toBe(100);
        expect(entry.score).toBeLessThanOrEqual(100);
    });

    it('scores an unparsable lastSeen as zero without leaking NaN', async () => {
        const scoring = await loadWith([
            metric({
                userId: 'broken',
                lastSeen: 'not-a-timestamp',
                time90d: 2 * HOUR
            }),
            metric({
                userId: 'fine',
                lastSeen: new Date().toISOString(),
                time90d: 2 * HOUR
            })
        ]);
        const broken = scoring.friendScores.value.get('broken');
        expect(broken.dimensions.recency).toBe(0);
        expect(Number.isFinite(broken.score)).toBe(true);
        expect(Number.isFinite(scoring.friendScores.value.get('fine').score)).toBe(
            true
        );
    });
});

describe('useRelationshipScoring trend and activity', () => {
    const daysAgo = (days) => new Date(Date.now() - days * DAY).toISOString();

    it('ranks a doubling month above flat above a halving one', async () => {
        const scoring = await loadWith([
            metric({
                userId: 'rising',
                lastSeen: daysAgo(1),
                time30d: 20 * HOUR,
                timePrev30d: 10 * HOUR
            }),
            metric({
                userId: 'flat',
                lastSeen: daysAgo(1),
                time30d: 10 * HOUR,
                timePrev30d: 10 * HOUR
            }),
            metric({
                userId: 'falling',
                lastSeen: daysAgo(1),
                time30d: 10 * HOUR,
                timePrev30d: 20 * HOUR
            })
        ]);
        const rising = scoring.friendScores.value.get('rising').dimensions.trend;
        const flat = scoring.friendScores.value.get('flat').dimensions.trend;
        const falling = scoring.friendScores.value.get('falling').dimensions.trend;
        expect(rising).toBeGreaterThan(flat);
        expect(flat).toBeGreaterThan(falling);
        expect(rising).toBeGreaterThanOrEqual(95);
        expect(falling).toBeLessThan(50);
    });

    it('reads a prior-window-only friend as cooling on the absolute scale', async () => {
        const scoring = await loadWith(
            [
                metric({
                    userId: 'dormant',
                    lastSeen: daysAgo(50),
                    time30d: 0,
                    timePrev30d: 50 * HOUR
                }),
                metric({
                    userId: 'steady',
                    lastSeen: daysAgo(1),
                    time30d: 10 * HOUR,
                    timePrev30d: 10 * HOUR
                })
            ],
            { afterLoad: (s) => s.setScoreMode('absolute') }
        );
        const dormant = scoring.friendScores.value.get('dormant').dimensions.trend;
        const steady = scoring.friendScores.value.get('steady').dimensions.trend;
        // Flat = 1000 exactly; a collapsed window reads well below it.
        expect(steady).toBeCloseTo(1000, -1);
        expect(dormant).toBeLessThan(100);
    });

    it('reads initiative direction with a neutral 1000 when balanced or absent', async () => {
        const scoring = await loadWith(
            [
                metric({
                    userId: 'they-come',
                    lastSeen: daysAgo(1),
                    friendInitiated: 3,
                    selfInitiated: 1
                }),
                metric({
                    userId: 'i-go',
                    lastSeen: daysAgo(1),
                    friendInitiated: 1,
                    selfInitiated: 3
                }),
                metric({ userId: 'unknown', lastSeen: daysAgo(1) })
            ],
            { afterLoad: (s) => s.setScoreMode('absolute') }
        );
        const they = scoring.friendScores.value.get('they-come').dimensions.activity;
        const iGo = scoring.friendScores.value.get('i-go').dimensions.activity;
        const unknown = scoring.friendScores.value.get('unknown').dimensions.activity;
        // (4/2)=2 -> 1585, (2/4)=0.5 -> 585, (1/1) -> 1000, all uncapped.
        expect(they).toBeGreaterThan(1500);
        expect(they).toBeLessThan(1650);
        expect(iGo).toBeGreaterThan(550);
        expect(iGo).toBeLessThan(620);
        expect(unknown).toBeCloseTo(1000, -1);
        expect(they).toBeGreaterThan(unknown);
        expect(unknown).toBeGreaterThan(iGo);
    });
});

describe('useRelationshipScoring freshness discount', () => {
    const daysAgo = (days) => new Date(Date.now() - days * DAY).toISOString();
    const base = {
        totalTime: 50 * HOUR,
        joinCount: 20,
        firstSeen: daysAgo(90),
        lastSeen: daysAgo(1),
        activeWeeks: 10
    };

    it('discounts a late-added friend with the same play as an early one', async () => {
        const scoring = await loadWith([
            metric({ userId: 'veteran', friendNumber: 1, ...base }),
            metric({ userId: 'latecomer', friendNumber: 40, ...base })
        ]);
        const veteran = scoring.friendScores.value.get('veteran');
        const latecomer = scoring.friendScores.value.get('latecomer');
        expect(veteran.dimensions.contact).toBe(100);
        expect(latecomer.dimensions.contact).toBeLessThan(85);
        expect(latecomer.dimensions.contact).toBeGreaterThanOrEqual(55);
    });

    it('does not punish a missing friendNumber', async () => {
        const scoring = await loadWith([
            metric({ userId: 'unknown-fn', friendNumber: 0, ...base }),
            metric({ userId: 'oldest', friendNumber: 1, ...base })
        ]);
        expect(
            scoring.friendScores.value.get('unknown-fn').dimensions.contact
        ).toBe(scoring.friendScores.value.get('oldest').dimensions.contact);
    });
});

describe('useRelationshipScoring weights and lambda', () => {
    const daysAgo = (days) => new Date(Date.now() - days * DAY).toISOString();
    const balanced = () =>
        metric({
            userId: 'balanced',
            totalTime: 40 * HOUR,
            joinCount: 16,
            firstSeen: daysAgo(60),
            lastSeen: daysAgo(1),
            activeWeeks: 8,
            time30d: 20 * HOUR,
            timePrev30d: 10 * HOUR,
            friendInitiated: 2,
            selfInitiated: 2
        });
    const spiky = () =>
        metric({
            userId: 'spiky',
            totalTime: 40 * HOUR,
            joinCount: 2,
            firstSeen: daysAgo(60),
            lastSeen: daysAgo(40),
            activeWeeks: 1,
            time30d: 0,
            timePrev30d: 40 * HOUR,
            friendInitiated: 0,
            selfInitiated: 4
        });

    it('recomputes scores from custom weights', async () => {
        const scoring = await loadWith([balanced()]);
        const before = scoring.friendScores.value.get('balanced').score;
        scoring.setWeight('recency', 100);
        scoring.setWeight('contact', 0);
        const after = scoring.friendScores.value.get('balanced').score;
        expect(after).not.toBe(before);
    });

    it('scores zero when every weight is zero', async () => {
        const scoring = await loadWith([balanced()], {
            afterLoad: (s) => {
                for (const key of [
                    'contact',
                    'regularity',
                    'recency',
                    'trend',
                    'activity'
                ]) {
                    s.setWeight(key, 0);
                }
            }
        });
        expect(scoring.friendScores.value.get('balanced').score).toBe(0);
    });

    it('punishes a one-factor spike harder as lambda rises', async () => {
        const scoring = await loadWith([balanced(), spiky()]);
        scoring.setLambda(-0.5);
        const lenient =
            scoring.friendScores.value.get('spiky').score -
            scoring.friendScores.value.get('balanced').score;
        scoring.setLambda(2);
        const strict =
            scoring.friendScores.value.get('spiky').score -
            scoring.friendScores.value.get('balanced').score;
        expect(strict).toBeLessThan(lenient);
    });

    it('hurts an even profile far less than a spike when lambda rises', async () => {
        const scoring = await loadWith([balanced(), spiky()]);
        scoring.setLambda(-0.5);
        const softBalanced = scoring.friendScores.value.get('balanced').score;
        const softSpiky = scoring.friendScores.value.get('spiky').score;
        scoring.setLambda(2);
        const hardBalanced = scoring.friendScores.value.get('balanced').score;
        const hardSpiky = scoring.friendScores.value.get('spiky').score;
        expect(softBalanced - hardBalanced).toBeLessThan(softSpiky - hardSpiky);
    });

    it('clamps lambda to its supported range', async () => {
        const scoring = await loadWith([balanced()], {
            afterLoad: (s) => {
                s.setLambda(99);
            }
        });
        expect(scoring.lambda.value).toBe(2);
        scoring.setLambda(-99);
        expect(scoring.lambda.value).toBe(-0.9);
    });
});

describe('useRelationshipScoring exclusions', () => {
    const now = new Date().toISOString();
    const metricsFor = () => [
        metric({ userId: 'normal-0', totalTime: 1000, lastSeen: now }),
        metric({ userId: 'normal-1', totalTime: 2000, lastSeen: now })
    ];

    it('full exclusion removes the friend from scoring and raises others', async () => {
        const scoring = await loadWith(metricsFor());
        const before = scoring.friendScores.value.get('normal-0').score;
        scoring.excludeFriend('normal-1');
        expect(scoring.friendScores.value.has('normal-1')).toBe(false);
        const after = scoring.friendScores.value.get('normal-0').score;
        expect(after).toBeGreaterThanOrEqual(before);
    });

    it('hidden exclusion keeps scores intact but hides from the list', async () => {
        const scoring = await loadWith(metricsFor(), {
            afterLoad: (s) => s.setExcludeMode('hidden')
        });
        const before = scoring.friendScores.value.get('normal-1').score;
        scoring.excludeFriend('normal-1');
        expect(scoring.friendScores.value.get('normal-1').score).toBe(before);
        expect(
            scoring.topFriends.value.map((f) => f.userId)
        ).not.toContain('normal-1');
    });

    it('excludes hidden friends from the distribution display', async () => {
        const scoring = await loadWith(metricsFor(), {
            afterLoad: (s) => s.setExcludeMode('hidden')
        });
        const totalBefore = scoring.scoreDistribution.value.reduce(
            (sum, b) => sum + b.count,
            0
        );
        scoring.excludeFriend('normal-1');
        const totalAfter = scoring.scoreDistribution.value.reduce(
            (sum, b) => sum + b.count,
            0
        );
        expect(totalAfter).toBe(totalBefore - 1);
    });

    it('restores every excluded friend at once', async () => {
        const scoring = await loadWith(metricsFor());
        scoring.excludeFriend('normal-0');
        scoring.excludeFriend('normal-1');
        expect(scoring.excludedFriends.value).toHaveLength(2);
        scoring.includeAllFriends();
        expect(scoring.excludedFriends.value).toHaveLength(0);
        expect(scoring.friendScores.value.size).toBe(2);
    });
});

describe('useRelationshipScoring score modes', () => {
    const now = new Date().toISOString();
    const metricsFor = () => {
        const metrics = [];
        for (let i = 0; i < 9; i++) {
            metrics.push(
                metric({
                    userId: `normal-${i}`,
                    totalTime: (i + 1) * 1e6,
                    joinCount: i + 1,
                    lastSeen: now
                })
            );
        }
        metrics.push(
            metric({
                userId: 'whale',
                totalTime: 1e9,
                joinCount: 500,
                lastSeen: now
            })
        );
        return metrics;
    };

    it('defaults to percent on a 0-100 scale', async () => {
        const scoring = await loadWith(metricsFor());
        expect(scoring.scoreMode.value).toBe('percent');
        expect(scoring.scoreMax.value).toBe(100);
    });

    it('scores absolute mode uncapped and to one decimal', async () => {
        // 2000 hours of co-presence, past the 500-hour anchor.
        const scoring = await loadWith(
            [
                metric({
                    userId: 'whale',
                    totalTime: 2000 * HOUR,
                    joinCount: 500,
                    lastSeen: now
                })
            ],
            { afterLoad: (s) => s.setScoreMode('absolute') }
        );
        const whale = scoring.friendScores.value.get('whale');
        expect(whale.dimensions.contact).toBeGreaterThan(1000);
        expect(Number.isInteger(whale.score * 10)).toBe(true);
    });

    it('keeps absolute scores stable when the cohort changes', async () => {
        const whaleMetric = metric({
            userId: 'whale',
            totalTime: 1e9,
            joinCount: 500,
            lastSeen: now
        });
        const alone = await loadWith([whaleMetric], {
            afterLoad: (s) => s.setScoreMode('absolute')
        });
        const aloneScore = alone.friendScores.value.get('whale').score;
        const inCrowd = await loadWith([...metricsFor()], {
            afterLoad: (s) => s.setScoreMode('absolute')
        });
        expect(inCrowd.friendScores.value.get('whale').score).toBe(aloneScore);
    });

    it('still moves percent scores with the cohort', async () => {
        const midMetric = metric({
            userId: 'mid',
            totalTime: 5e6,
            joinCount: 5,
            lastSeen: now
        });
        const whaleMetric = metric({
            userId: 'whale',
            totalTime: 1e9,
            joinCount: 500,
            lastSeen: now
        });
        const alone = await loadWith([midMetric]);
        const aloneScore = alone.friendScores.value.get('mid').score;
        const aloneContact = alone.friendScores.value.get('mid').dimensions.contact;
        const inCrowd = await loadWith([midMetric, whaleMetric]);
        const crowdScore = inCrowd.friendScores.value.get('mid').score;
        const crowdContact = inCrowd.friendScores.value.get('mid').dimensions.contact;
        // Percent ranks against the cohort; absolute must not.
        expect(aloneContact).toBe(100);
        expect(crowdContact).toBeLessThan(aloneContact);
        expect(aloneScore).toBeGreaterThan(crowdScore);
        expect(crowdScore).toBeLessThanOrEqual(100);
    });

    it('rejects unknown score modes', async () => {
        const scoring = await loadWith(metricsFor());
        scoring.setScoreMode('nonsense');
        expect(scoring.scoreMode.value).toBe('percent');
    });

    it('restores the score mode on a new instance', async () => {
        await loadWith(metricsFor(), {
            afterLoad: (s) => s.setScoreMode('absolute')
        });
        const second = await loadWith(metricsFor());
        expect(second.scoreMode.value).toBe('absolute');
    });

    it('restores weights, lambda, exclusions, and mode on a new instance', async () => {
        await loadWith(metricsFor(), {
            afterLoad: (s) => {
                s.setWeight('contact', 70);
                s.setLambda(1.2);
                s.excludeFriend('normal-0');
                s.setExcludeMode('hidden');
                s.setScoreMode('absolute');
            }
        });
        const second = await loadWith(metricsFor());
        expect(second.weights.value.contact).toBe(70);
        expect(second.lambda.value).toBe(1.2);
        expect(second.excludedUserIds.value).toEqual(['normal-0']);
        expect(second.excludeMode.value).toBe('hidden');
        expect(second.scoreMode.value).toBe('absolute');
    });
});
