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
const SCORE_MODE_CONFIG_KEY = 'intimacyScoreMode';

const RECENCY_FAST_DAYS = 14;
const RECENCY_SLOW_DAYS = 120;
const RECENCY_FAST_SHARE = 0.6;
// Contact density (distinct days over relationship age) counts as fully
// regular at one meeting every ~10 days; below that the dimension slides
// toward the floor, so a one-off encounter can't read as a kept-up friendship.
const RECENCY_DENSITY_REF = 0.1;
const RECENCY_PERSISTENCE_FLOOR = 0.5;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// 'percent' divides each dimension by the cohort's p90 reference and caps at
// 1; 'absolute' uses fixed anchors instead (so a score never moves when
// unrelated friends appear or grow) and stays uncapped, so a friend past an
// anchor reads as more than the anchor rather than clamping to it. The scale
// is the anchor's full-mark value, not a ceiling. Anchors are in each
// dimension's own unit (totalTime is milliseconds, so overlap is converted to
// hours first — log1p on raw milliseconds barely moves below the anchor).
const SCORE_SCALES = { percent: 100, absolute: 1000 };
const ABSOLUTE_ANCHORS = {
    onlineOverlap: 1000,
    coWorldFrequency: 500,
    consistency: 365
};

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

function logRatio(value, reference) {
    if (reference <= 0) return 0;
    return Math.log1p(value) / reference;
}

// Two-term decay: the fast term (τ=14d) separates friends seen this week from
// friends seen this month, the slow term (τ=120d) keeps a long-absent friend
// from collapsing to zero the way a single 90-day curve did.
function recencyBase(daysSince) {
    return (
        RECENCY_FAST_SHARE * Math.exp(-daysSince / RECENCY_FAST_DAYS) +
        (1 - RECENCY_FAST_SHARE) * Math.exp(-daysSince / RECENCY_SLOW_DAYS)
    );
}

// Recent-contact regularity, derived from aggregates the metrics already carry:
// distinct days over the age of the relationship. Missing or invalid firstSeen
// (legacy rows) skips the penalty instead of guessing.
function recencyPersistence(metric, now) {
    if (!metric.firstSeen) return 1;
    const firstSeen = new Date(metric.firstSeen).getTime();
    if (!Number.isFinite(firstSeen)) return 1;
    const ageDays = Math.max(1, (now - firstSeen) / MS_PER_DAY);
    const density = Math.min(
        1,
        Math.max(0, metric.distinctDays || 0) / ageDays
    );
    const fidelity = Math.min(1, density / RECENCY_DENSITY_REF);
    return (
        RECENCY_PERSISTENCE_FLOOR +
        (1 - RECENCY_PERSISTENCE_FLOOR) * fidelity
    );
}

function recencyScore(metric, now) {
    if (!metric.lastSeen) return 0;
    const lastSeen = new Date(metric.lastSeen).getTime();
    if (!Number.isFinite(lastSeen)) return 0;
    // A future timestamp (clock skew) reads as "just seen", never above 1.
    const daysSince = Math.max(0, (now - lastSeen) / MS_PER_DAY);
    return Math.min(
        1,
        recencyBase(daysSince) * recencyPersistence(metric, now)
    );
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
    const scoreMode = ref('percent');

    let preferencesPromise = null;
    function loadPreferences() {
        if (!preferencesPromise) {
            preferencesPromise = (async () => {
                try {
                    const [savedWeights, savedExcluded, savedMode, savedScoreMode] =
                        await Promise.all([
                            configRepository.getObject(
                                WEIGHTS_CONFIG_KEY,
                                null
                            ),
                            configRepository.getArray(EXCLUDED_CONFIG_KEY, []),
                            configRepository.getString(
                                EXCLUDE_MODE_CONFIG_KEY,
                                'full'
                            ),
                            configRepository.getString(
                                SCORE_MODE_CONFIG_KEY,
                                'percent'
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
                    scoreMode.value =
                        savedScoreMode === 'absolute' ? 'absolute' : 'percent';
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
        const absolute = scoreMode.value === 'absolute';
        const scale = SCORE_SCALES[scoreMode.value];

        const overlapRef = absolute
            ? Math.log1p(ABSOLUTE_ANCHORS.onlineOverlap)
            : logPercentileReference(
                  scoredMetrics.map((m) => Math.log1p(m.totalTime))
              );
        const frequencyRef = absolute
            ? Math.log1p(ABSOLUTE_ANCHORS.coWorldFrequency)
            : logPercentileReference(
                  scoredMetrics.map((m) => Math.log1p(m.joinCount))
              );
        const consistencyRef = absolute
            ? Math.log1p(ABSOLUTE_ANCHORS.consistency)
            : logPercentileReference(
                  scoredMetrics.map((m) => Math.log1p(m.distinctDays))
              );
        const w = weights.value;
        const weightSum =
            w.onlineOverlap + w.coWorldFrequency + w.recency + w.consistency;
        const norm = absolute ? logRatio : logNormalize;
        const roundDimension = absolute
            ? (value) => Math.round(value * scale * 10) / 10
            : (value) => Math.round(value * scale);

        const scores = new Map();
        const now = Date.now();

        for (const metric of scoredMetrics) {
            const overlapValue = absolute
                ? metric.totalTime / MS_PER_HOUR
                : metric.totalTime;
            const onlineOverlap = norm(overlapValue, overlapRef);
            const coWorldFrequency = norm(metric.joinCount, frequencyRef);
            const recency = recencyScore(metric, now);
            const consistency = norm(metric.distinctDays, consistencyRef);

            const dimensions = {
                onlineOverlap: roundDimension(onlineOverlap),
                coWorldFrequency: roundDimension(coWorldFrequency),
                recency: roundDimension(recency),
                consistency: roundDimension(consistency)
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
                score: absolute
                    ? Math.round(totalScore * 10) / 10
                    : Math.round(totalScore),
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
            .map(([userId, data]) => ({
                userId,
                displayName: data.displayName,
                score: data.score,
                dimensions: data.dimensions,
                raw: data.raw
            }));
    });

    // Percent stays a fixed 0-100 scale; absolute has no ceiling, so the
    // displayed full mark is the best score currently on the board.
    const scoreMax = computed(() => {
        if (scoreMode.value !== 'absolute') return SCORE_SCALES.percent;
        const excluded = new Set(excludedUserIds.value);
        let max = 0;
        for (const [userId, data] of friendScores.value) {
            if (excluded.has(userId)) continue;
            if (data.score > max) max = data.score;
        }
        return max;
    });

    const scoreDistribution = computed(() => {
        const excluded = new Set(excludedUserIds.value);
        const step = Math.max(1, Math.ceil(scoreMax.value / 10));
        const buckets = Array.from({ length: 10 }, () => 0);
        for (const [userId, data] of friendScores.value) {
            if (excluded.has(userId)) continue;
            const bucket = Math.min(9, Math.floor(data.score / step));
            buckets[bucket]++;
        }
        const maxCount = Math.max(...buckets, 1);
        return buckets.map((count, i) => ({
            range: `${i * step}-${(i + 1) * step}`,
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

    function includeAllFriends() {
        excludedUserIds.value = [];
        configRepository.setArray(EXCLUDED_CONFIG_KEY, []);
    }

    function setExcludeMode(mode) {
        excludeMode.value = mode;
        configRepository.setString(EXCLUDE_MODE_CONFIG_KEY, mode);
    }

    function setScoreMode(mode) {
        if (mode !== 'absolute' && mode !== 'percent') return;
        scoreMode.value = mode;
        configRepository.setString(SCORE_MODE_CONFIG_KEY, mode);
    }

    return {
        friendScores,
        isLoading,
        loadScores,
        getScoreForFriend,
        topFriends,
        scoreDistribution,
        scoreMax,
        scoreMode,
        weights,
        excludedUserIds,
        excludeMode,
        excludedFriends,
        setWeight,
        resetWeights,
        excludeFriend,
        includeFriend,
        includeAllFriends,
        setExcludeMode,
        setScoreMode
    };
}
