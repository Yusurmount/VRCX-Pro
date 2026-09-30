import { ref, computed } from 'vue';
import { useUserStore } from '../../../stores';
import { database } from '../../../services/database';
import configRepository from '../../../services/config';

const DEFAULT_WEIGHTS = {
    onlineOverlap: 40,
    coWorldFrequency: 30,
    recency: 20,
    consistency: 10
};

const WEIGHTS_CONFIG_KEY = 'intimacyWeights';
const EXCLUDED_CONFIG_KEY = 'intimacyExcludedFriends';
const EXCLUDE_MODE_CONFIG_KEY = 'intimacyExcludeMode';

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

    const weights = ref({ ...DEFAULT_WEIGHTS });
    const excludedUserIds = ref([]);
    // 'full': excluded friends leave the scoring set entirely;
    // 'hidden': they still affect normalization but never render.
    const excludeMode = ref('full');

    let preferencesPromise = null;
    function loadPreferences() {
        if (!preferencesPromise) {
            preferencesPromise = (async () => {
                try {
                    const [savedWeights, savedExcluded, savedMode] =
                        await Promise.all([
                            configRepository.getObject(
                                WEIGHTS_CONFIG_KEY,
                                null
                            ),
                            configRepository.getArray(EXCLUDED_CONFIG_KEY, []),
                            configRepository.getString(
                                EXCLUDE_MODE_CONFIG_KEY,
                                'full'
                            )
                        ]);
                    if (savedWeights && typeof savedWeights === 'object') {
                        weights.value = {
                            ...DEFAULT_WEIGHTS,
                            ...savedWeights
                        };
                    }
                    if (Array.isArray(savedExcluded)) {
                        excludedUserIds.value = savedExcluded.filter(
                            (id) => typeof id === 'string'
                        );
                    }
                    excludeMode.value =
                        savedMode === 'hidden' ? 'hidden' : 'full';
                } catch (err) {
                    console.error(
                        '[useRelationshipScoring] Failed to load preferences',
                        err
                    );
                }
            })();
        }
        return preferencesPromise;
    }
    loadPreferences();

    const scoringMetrics = computed(() => {
        const excluded = new Set(excludedUserIds.value);
        return rawMetrics.value.filter((m) => {
            if (!m.userId) return false;
            if (excludeMode.value === 'full' && excluded.has(m.userId)) {
                return false;
            }
            return true;
        });
    });

    const friendScores = computed(() => {
        if (!scoringMetrics.value.length) return new Map();

        const scoredMetrics = scoringMetrics.value;
        const overlapRef = logPercentileReference(
            scoredMetrics.map((m) => Math.log1p(m.totalTime))
        );
        const frequencyRef = logPercentileReference(
            scoredMetrics.map((m) => Math.log1p(m.joinCount))
        );
        const consistencyRef = logPercentileReference(
            scoredMetrics.map((m) => Math.log1p(m.distinctDays))
        );
        const w = weights.value;
        const weightSum =
            w.onlineOverlap + w.coWorldFrequency + w.recency + w.consistency;

        const scores = new Map();

        for (const metric of scoredMetrics) {
            const onlineOverlap = logNormalize(metric.totalTime, overlapRef);
            const coWorldFrequency = logNormalize(metric.joinCount, frequencyRef);
            const recency = recencyScore(metric.lastSeen);
            const consistency = logNormalize(metric.distinctDays, consistencyRef);

            const dimensions = {
                onlineOverlap: Math.round(onlineOverlap * 100),
                coWorldFrequency: Math.round(coWorldFrequency * 100),
                recency: Math.round(recency * 100),
                consistency: Math.round(consistency * 100)
            };
            const totalScore =
                weightSum > 0
                    ? (w.onlineOverlap * dimensions.onlineOverlap +
                          w.coWorldFrequency * dimensions.coWorldFrequency +
                          w.recency * dimensions.recency +
                          w.consistency * dimensions.consistency) /
                      weightSum
                    : 0;

            scores.set(metric.userId, {
                score: Math.round(totalScore),
                dimensions,
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
        const excluded = new Set(excludedUserIds.value);
        return Array.from(friendScores.value.entries())
            .filter(([userId]) => !excluded.has(userId))
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
        const excluded = new Set(excludedUserIds.value);
        const buckets = Array.from({ length: 10 }, () => 0);
        for (const [userId, data] of friendScores.value) {
            if (excluded.has(userId)) continue;
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

    const excludedFriends = computed(() => {
        return excludedUserIds.value.map((userId) => {
            const metric = rawMetrics.value.find(
                (m) => m.userId === userId
            );
            return {
                userId,
                displayName: metric?.displayName || userId
            };
        });
    });

    async function loadScores() {
        isLoading.value = true;
        try {
            await loadPreferences();
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

    function setWeight(key, value) {
        weights.value[key] = value;
        configRepository.setObject(WEIGHTS_CONFIG_KEY, { ...weights.value });
    }

    function resetWeights() {
        weights.value = { ...DEFAULT_WEIGHTS };
        configRepository.setObject(WEIGHTS_CONFIG_KEY, { ...weights.value });
    }

    function excludeFriend(userId) {
        if (excludedUserIds.value.includes(userId)) return;
        excludedUserIds.value = [...excludedUserIds.value, userId];
        configRepository.setArray(EXCLUDED_CONFIG_KEY, excludedUserIds.value);
    }

    function includeFriend(userId) {
        excludedUserIds.value = excludedUserIds.value.filter(
            (id) => id !== userId
        );
        configRepository.setArray(EXCLUDED_CONFIG_KEY, excludedUserIds.value);
    }

    function setExcludeMode(mode) {
        excludeMode.value = mode;
        configRepository.setString(EXCLUDE_MODE_CONFIG_KEY, mode);
    }

    return {
        friendScores,
        isLoading,
        loadScores,
        getScoreForFriend,
        topFriends,
        scoreDistribution,
        weights,
        excludedUserIds,
        excludeMode,
        excludedFriends,
        setWeight,
        resetWeights,
        excludeFriend,
        includeFriend,
        setExcludeMode
    };
}
