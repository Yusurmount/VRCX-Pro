import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFriendStore, useUserStore } from '../../../stores';
import { database } from '../../../services/database';

const WEIGHTS = {
    onlineOverlap: 0.4,
    coWorldFrequency: 0.3,
    recency: 0.2,
    consistency: 0.1
};

const RECENCY_DECAY_DAYS = 90;

function normalizeValue(value, max) {
    if (!max || max === 0) return 0;
    return Math.min(1, value / max);
}

function recencyScore(lastSeenTimestamp) {
    if (!lastSeenTimestamp) return 0;
    const now = Date.now();
    const lastSeen = new Date(lastSeenTimestamp).getTime();
    const daysSince = (now - lastSeen) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.exp(-daysSince / RECENCY_DECAY_DAYS));
}

export function useRelationshipScoring() {
    const friendStore = useFriendStore();
    const userStore = useUserStore();
    const { friends } = storeToRefs(friendStore);

    const rawMetrics = ref([]);
    const isLoading = ref(false);

    const friendScores = computed(() => {
        if (!rawMetrics.value.length) return new Map();

        const maxTime = Math.max(...rawMetrics.value.map((m) => m.totalTime), 1);
        const maxJoins = Math.max(...rawMetrics.value.map((m) => m.joinCount), 1);
        const maxDays = Math.max(...rawMetrics.value.map((m) => m.distinctDays), 1);

        const scores = new Map();

        for (const metric of rawMetrics.value) {
            if (!metric.userId) continue;

            const onlineOverlap = normalizeValue(metric.totalTime, maxTime);
            const coWorldFrequency = normalizeValue(metric.joinCount, maxJoins);
            const recency = recencyScore(metric.lastSeen);
            const consistency = normalizeValue(metric.distinctDays, maxDays);

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
            range: ${i * 10}-,
            count,
            percent: Math.round((count / maxCount) * 100)
        }));
    });

    async function loadScores() {
        isLoading.value = true;
        try {
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
