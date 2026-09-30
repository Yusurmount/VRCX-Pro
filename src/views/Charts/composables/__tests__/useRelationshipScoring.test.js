import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    ensureUserContext: vi.fn(),
    getFriendshipMetrics: vi.fn()
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
