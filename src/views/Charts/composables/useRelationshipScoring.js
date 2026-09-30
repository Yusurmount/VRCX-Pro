import { ref, computed } from 'vue';
import { useUserStore } from '../../../stores';
import { database } from '../../../services/database';

const WEIGHTS = {
    onlineOverlap: 0.4,
    coWorldFrequency: 0.3,
    recency: 0.2,
    consistency: 0.1
};

const RECENCY_DECAY_DAYS = 90;

// log1p + nearest-rank p90 keeps a single whale friend from flattening
// everyone else the way max-normalization did.
function logPercentileReference(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(0.9 * sorted.length) - 1;
    return sorted[Math.max(0, index)];
}

function logNormalize(value, reference) {
    if (reference <= 0) return 0;
    return Math.min(1, Math.log1p(value) / reference);
}

function recencyScore(lastSeenTimestamp) {
    if (!lastSeenTimestamp) return 0;
    const now = Date.now();
    const lastSeen = new Date(lastSeenTimestamp).getTime();
    const daysSince = (now - lastSeen) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.exp(-daysSince / RECENCY_DECAY_DAYS));
}

export function useRelationshipScoring() {
    const userStore = useUserStore();
    const rawMetrics = ref([]);
    const isLoading = ref(false);

    const friendScores = computed(() => {
        if (!rawMetrics.value.length) return new Map();

        const scoredMetrics = rawMetrics.value.filter((m) => m.userId);
        const overlapRef = logPercentileReference(
            scoredMetrics.map((m) => Math.log1p(m.totalTime))
        );
        const frequencyRef = logPercentileReference(
            scoredMetrics.map((m) => Math.log1p(m.joinCount))
        );
        const consistencyRef = logPercentileReference(
            scoredMetrics.map((m) => Math.log1p(m.distinctDays))
        );

        const scores = new Map();

        for (const metric of scoredMetrics) {
            const onlineOverlap = logNormalize(metric.totalTime, overlapRef);
            const coWorldFrequency = logNormalize(metric.joinCount, frequencyRef);
            const recency = recencyScore(metric.lastSeen);
            const consistency = logNormalize(metric.distinctDays, consistencyRef);

            const totalScore =
                WEIGHTS.onlineOverlap * onlineOverlap +
                WEIGHTS.coWorldFrequency * coWorldFrequency +
                WEIGHTS.recency * recency +
                WEIGHTS.consistency * consistency;

            scores.set(metric.userId, {
                score: Math.round(totalScore * 100),
                dimensions: {
                    onlineOverlap: Math.round(onlineOverlap * 100),
                    coWorldFrequency: Math.round(coWorldFrequency * 100),
                    recency: Math.round(recency * 100),
                    consistency: Math.round(consistency * 100)
                },
                raw: {
                    totalTime: metric.totalTime,
                    joinCount: metric.joinCount,
                    firstSeen: metric.firstSeen,
                    lastSeen: metric.lastSeen,
                    distinctDays: metric.distinctDays
                },
                displayName: metric.displayName
            });
        }

        return scores;
    });

    const topFriends = computed(() => {
        return Array.from(friendScores.value.entries())
            .sort((a, b) => b[1].score - a[1].score)
            .slice(0, 20)
            .map(([userId, data]) => ({
                userId,
                displayName: data.displayName,
                score: data.score,
                dimensions: data.dimensions,
                raw: data.raw
            }));
    });

    const scoreDistribution = computed(() => {
        const buckets = Array.from({ length: 10 }, () => 0);
        for (const [, data] of friendScores.value) {
            const bucket = Math.min(9, Math.floor(data.score / 10));
            buckets[bucket]++;
        }
        const maxCount = Math.max(...buckets, 1);
        return buckets.map((count, i) => ({
            range: `${i * 10}-${(i + 1) * 10}`,
            count,
            percent: Math.round((count / maxCount) * 100)
        }));
    });

    async function loadScores() {
        isLoading.value = true;
        try {
            const contextReady = await database.ensureUserContext(
                userStore.currentUser?.id
            );
            if (!contextReady) {
                rawMetrics.value = [];
                return;
            }
            rawMetrics.value = await database.getFriendshipMetrics();
        } catch (err) {
            console.error('[useRelationshipScoring] Failed to load metrics', err);
            rawMetrics.value = [];
        } finally {
            isLoading.value = false;
        }
    }

    function getScoreForFriend(userId) {
        return friendScores.value.get(userId) || null;
    }

    return {
        friendScores,
        isLoading,
        loadScores,
        getScoreForFriend,
        topFriends,
        scoreDistribution
    };
}
