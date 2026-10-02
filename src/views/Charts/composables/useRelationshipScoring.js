import { ref, computed } from 'vue';
import { useUserStore } from '../../../stores';
import { database } from '../../../services/database';
import configRepository from '../../../services/config';

// Five criteria: contact surface (volume+structure), regularity, recency,
// trend, activity. Weight sliders feed a linear share; lambda drives a
// Sugeno-measure Choquet integral so criteria can constrain or substitute
// each other instead of a plain weighted sum.
const CRITERIA = [
    'contact',
    'regularity',
    'recency',
    'trend',
    'activity'
];

const DEFAULT_WEIGHTS = {
    contact: 35,
    regularity: 15,
    recency: 20,
    trend: 12,
    activity: 18
};

// lambda > 0: superadditive set measure -> a single weak criterion bites
// harder (mutual constraint). lambda < 0: subadditive -> criteria substitute
// each other (one strength can cover a gap). lambda = 0 falls back to a
// plain weighted mean, continuously.
const DEFAULT_LAMBDA = 0.5;
const LAMBDA_MIN = -0.9;
const LAMBDA_MAX = 2;

const WEIGHTS_CONFIG_KEY = 'intimacyWeights';
const LAMBDA_CONFIG_KEY = 'intimacyLambda';
const EXCLUDED_CONFIG_KEY = 'intimacyExcludedFriends';
const EXCLUDE_MODE_CONFIG_KEY = 'intimacyExcludeMode';
const SCORE_MODE_CONFIG_KEY = 'intimacyScoreMode';

const RECENCY_FAST_DAYS = 14;
const RECENCY_SLOW_DAYS = 120;
const RECENCY_FAST_SHARE = 0.6;

// Coherence gate: average session depth below D50 reads as fragmented
// presence (reconnects, drop-bys) and freezes the structure factors at the
// cohort mean instead of trusting noisy counts.
const DEPTH_REF_MS = 18 * 60 * 1000;
const DEPTH_HILL_N = 2.6;
const SHRINK_EXP = 0.8;

// Structure share inside the contact surface. Total time is the anchor
// (blocks summed directly, never N×D), session depth is the quality trim.
const STRUCTURE_FLOOR = 0.35;

// Freshness: friend_number rank -> S-shaped discount in [0.6, 0.98].
const FRESHNESS_FLOOR = 0.6;
const FRESHNESS_K = 6;

// Trend windows compare this 30 days against the previous one as a ratio;
// the epsilon swamps sub-half-hour noise so a brand-new database does not
// explode the ratio when the prior window is empty.
const TREND_EPS_HOURS = 0.5;

// Regularity counts accumulated active weeks — an unbounded physical
// quantity. The old coverage/0.3 formula pinned everyone at 1000 whenever
// the relationship was younger than ~3 weeks (coverage collapses to 1).
// This anchor is "active for half a year", the standard-line for routine
// contact. Trend and activity use ratio anchors of 1 (balanced = 1000).

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// 'percent' normalizes each physical quantity against the cohort's p90 and
// caps at 1; 'absolute' uses fixed anchors instead (so a score never moves
// when unrelated friends appear or grow) and stays UNCAPPED — every
// dimension can exceed its anchor's 1000 points. Anchors are calibrated
// against the real database: true co-presence p90 ≈ 1.1 h, so 1 h is the
// contact/recency standard line and 26 active weeks the regularity one.
const SCORE_SCALES = { percent: 100, absolute: 1000 };
const ABSOLUTE_ANCHORS = {
    contactHours: 1,
    depthHours: 2,
    activeWeeks: 26,
    recencyHours: 1
};
const RATIO_ANCHOR = 1;

function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}

function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}

function hill(value, ref, n) {
    const v = Math.max(0, value);
    const vn = Math.pow(v, n);
    return vn / (vn + Math.pow(ref, n));
}

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
// from collapsing to zero the way a single 90-day curve did. Here it only
// modulates the rolling-window volume — it can never lift a dimension on its
// own, so a friend with no recent co-presence scores zero regardless of how
// the curve would decay.
function recencyBase(daysSince) {
    return (
        RECENCY_FAST_SHARE * Math.exp(-daysSince / RECENCY_FAST_DAYS) +
        (1 - RECENCY_FAST_SHARE) * Math.exp(-daysSince / RECENCY_SLOW_DAYS)
    );
}

function recencyModulation(metric, now) {
    if (!metric.lastSeen) return 0;
    const lastSeen = new Date(metric.lastSeen).getTime();
    if (!Number.isFinite(lastSeen)) return 0;
    // A future timestamp (clock skew) reads as "just seen", never above 1.
    const daysSince = Math.max(0, (now - lastSeen) / MS_PER_DAY);
    return recencyBase(daysSince);
}

// Physical quantities feeding the shared log-ratio pipeline. Each one is an
// unbounded real-world measurement; the log1p transform keeps them tame and
// the anchor (absolute) or cohort p90 (percent) turns them into 0..1000.
function contactHoursOf(metric) {
    return Math.max(0, metric.totalTime || 0) / MS_PER_HOUR;
}

function recencyHoursOf(metric) {
    // Rolling 90-day co-presence: zero beyond the window by construction, so
    // a long-dormant friend bottoms out without an extra gate.
    return Math.max(0, metric.time90d || 0) / MS_PER_HOUR;
}

function activeWeeksOf(metric) {
    return Math.max(0, metric.activeWeeks || 0);
}

// (this window + eps) / (previous window + eps): 1 = flat, >1 warming,
// <1 cooling. The epsilon both swamps sub-half-hour noise and keeps the
// fresh-database case (prior = 0) from dividing by zero — it still reads as
// warming, which is factually what a first month looks like.
function trendRatio(metric) {
    const recent = Math.max(0, metric.time30d || 0) / MS_PER_HOUR;
    const prior = Math.max(0, metric.timePrev30d || 0) / MS_PER_HOUR;
    return (recent + TREND_EPS_HOURS) / (prior + TREND_EPS_HOURS);
}

// Laplace-smoothed initiation ratio: 1 = balanced (1000 pts), >1 they come
// to you, <1 you do all the travelling. The +1 priors keep an empty history
// at neutral instead of dividing by zero.
function activityRatio(metric) {
    const theirs = Math.max(0, metric.friendInitiated || 0);
    const mine = Math.max(0, metric.selfInitiated || 0);
    return (theirs + 1) / (mine + 1);
}

function depthHoursOf(metric) {
    return metric.joinCount > 0
        ? Math.max(0, metric.totalTime || 0) / metric.joinCount / MS_PER_HOUR
        : 0;
}

// friend_number rank -> seniority: 1 for the oldest slot, 0 for the newest,
// 1 when the number is unknown. Missing numbers stay unpunished.
function seniority(friendNumber, maxFriendNumber) {
    if (!friendNumber || friendNumber <= 0) return 1;
    if (!maxFriendNumber || maxFriendNumber <= 1) return 1;
    return clamp01(1 - (friendNumber - 1) / (maxFriendNumber - 1));
}

function freshnessDiscount(s) {
    // Rescaled sigmoid so s=1 lands exactly on the floor of the penalty
    // band (no discount) and s=0 on a full one-third off.
    const lo = sigmoid(-FRESHNESS_K * 0.5);
    const hi = sigmoid(FRESHNESS_K * 0.5);
    const t = (sigmoid(FRESHNESS_K * (s - 0.5)) - lo) / (hi - lo);
    return FRESHNESS_FLOOR + (1 - FRESHNESS_FLOOR) * t;
}

// Soft-threshold membership for the percent scale: identity at the ends and
// mid-point, S-shape in between, so middling factors neither dominate nor
// vanish inside the integral.
const MEMBERSHIP_KAPPA = 6;

function membership(z) {
    const lo = sigmoid(-MEMBERSHIP_KAPPA * 0.5);
    const hi = sigmoid(MEMBERSHIP_KAPPA * 0.5);
    return clamp01(
        (sigmoid(MEMBERSHIP_KAPPA * (z - 0.5)) - lo) / (hi - lo)
    );
}

// Sugeno lambda-measure normalized to g(X)=1 so lambda can be dialled
// freely. lambda=0 degrades to the additive share continuously.
function sugenoMeasure(setIdx, densities, lambda) {
    if (Math.abs(lambda) < 1e-9) {
        let sum = 0;
        for (const i of setIdx) sum += densities[i];
        return sum;
    }
    let prod = 1;
    for (const i of setIdx) prod *= 1 + lambda * densities[i];
    let denom = 1;
    for (let i = 0; i < densities.length; i++) {
        denom *= 1 + lambda * densities[i];
    }
    return (prod - 1) / (denom - 1);
}

// Discrete Choquet integral over the fuzzy measure above: sort ascending and
// accumulate each level gain against the measure of "everything at least
// this good", which is exactly where the interaction lambda acts.
function choquetIntegral(memberships, densities, lambda) {
    const n = memberships.length;
    const order = [...Array(n).keys()].sort(
        (a, b) => memberships[a] - memberships[b]
    );
    let result = 0;
    let prev = 0;
    for (let k = 0; k < n; k++) {
        const m = memberships[order[k]];
        if (m > prev) {
            result +=
                (m - prev) * sugenoMeasure(order.slice(k), densities, lambda);
            prev = m;
        }
    }
    return result;
}

function weightDensities(weightMap) {
    let sum = 0;
    for (const key of CRITERIA) sum += Math.max(0, weightMap[key] || 0);
    if (sum <= 0) return null;
    const densities = [];
    for (const key of CRITERIA) {
        densities.push(Math.max(0, weightMap[key] || 0) / sum);
    }
    return densities;
}

export function useRelationshipScoring() {
    const userStore = useUserStore();
    const rawMetrics = ref([]);
    const isLoading = ref(false);

    const weights = ref({ ...DEFAULT_WEIGHTS });
    const lambda = ref(DEFAULT_LAMBDA);
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
                    const [savedWeights, savedLambda, savedExcluded, savedMode, savedScoreMode] =
                        await Promise.all([
                            configRepository.getObject(
                                WEIGHTS_CONFIG_KEY,
                                null
                            ),
                            configRepository.getObject(LAMBDA_CONFIG_KEY, null),
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
                    if (
                        savedWeights &&
                        typeof savedWeights === 'object' &&
                        CRITERIA.every((key) => key in savedWeights)
                    ) {
                        weights.value = {
                            ...DEFAULT_WEIGHTS,
                            ...savedWeights
                        };
                    }
                    if (
                        typeof savedLambda === 'number' &&
                        Number.isFinite(savedLambda)
                    ) {
                        lambda.value = Math.min(
                            LAMBDA_MAX,
                            Math.max(LAMBDA_MIN, savedLambda)
                        );
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

        // Reference = log1p(anchor) in absolute mode (fixed standard line),
        // log1p(p90) of the cohort in percent mode (relative standing).
        const refOf = (rawValues, anchor) =>
            absolute
                ? Math.log1p(anchor)
                : logPercentileReference(rawValues.map((v) => Math.log1p(v)));

        const contactRaw = scoredMetrics.map(contactHoursOf);
        const depthRaw = scoredMetrics.map(depthHoursOf);
        const weeksRaw = scoredMetrics.map(activeWeeksOf);
        const recencyRaw = scoredMetrics.map(recencyHoursOf);
        const trendRaw = scoredMetrics.map(trendRatio);
        const activityRaw = scoredMetrics.map(activityRatio);

        const refs = {
            contact: refOf(contactRaw, ABSOLUTE_ANCHORS.contactHours),
            depth: refOf(depthRaw, ABSOLUTE_ANCHORS.depthHours),
            regularity: refOf(weeksRaw, ABSOLUTE_ANCHORS.activeWeeks),
            recency: refOf(recencyRaw, ABSOLUTE_ANCHORS.recencyHours),
            trend: refOf(trendRaw, RATIO_ANCHOR),
            activity: refOf(activityRaw, RATIO_ANCHOR)
        };

        const norm = absolute ? logRatio : logNormalize;
        // Shrinkage target: the cohort mean on the relative scale (what a
        // "typical" friend looks like), the anchor on the absolute one (so
        // scores stay put when the cohort moves).
        let depthTarget = 1;
        if (!absolute) {
            depthTarget =
                depthRaw.reduce((s, v) => s + norm(v, refs.depth), 0) /
                depthRaw.length;
        }

        let maxFriendNumber = 0;
        for (const m of scoredMetrics) {
            if ((m.friendNumber || 0) > maxFriendNumber) {
                maxFriendNumber = m.friendNumber;
            }
        }

        const densities = weightDensities(weights.value);
        const now = Date.now();

        const scores = new Map();
        if (!densities) {
            for (const metric of scoredMetrics) {
                scores.set(metric.userId, {
                    score: 0,
                    dimensions: Object.fromEntries(
                        CRITERIA.map((key) => [key, 0])
                    ),
                    raw: rawOf(metric),
                    displayName: metric.displayName
                });
            }
            return scores;
        }

        for (const metric of scoredMetrics) {
            // Coherence: 0.5 at DEPTH_REF_MS, saturating slowly past it.
            const coherence = hill(
                metric.joinCount > 0 ? (metric.totalTime || 0) / metric.joinCount : 0,
                DEPTH_REF_MS,
                DEPTH_HILL_N
            );

            const vContact = norm(contactHoursOf(metric), refs.contact);
            const vDepth = norm(depthHoursOf(metric), refs.depth);

            // James-Stein style shrinkage: fragmented presence pulls its
            // noisy depth estimate back toward typical instead of trusting a
            // reconnect-shredded average. Depth alone carries the structure
            // (count and depth are not independent: N = T / D).
            const structure =
                depthTarget +
                (vDepth - depthTarget) * Math.pow(coherence, SHRINK_EXP);

            const s = seniority(metric.friendNumber, maxFriendNumber);
            const delta = freshnessDiscount(s);
            const contact =
                delta *
                vContact *
                (STRUCTURE_FLOOR + (1 - STRUCTURE_FLOOR) * structure);

            const z = {
                contact,
                regularity: norm(activeWeeksOf(metric), refs.regularity),
                recency:
                    norm(recencyHoursOf(metric), refs.recency) *
                    recencyModulation(metric, now),
                trend: norm(trendRatio(metric), refs.trend),
                activity: norm(activityRatio(metric), refs.activity)
            };

            // Percent scale feeds the integral soft memberships; the absolute
            // scale passes the log-ratio scores through so they stay
            // uncapped — a dimension can read past its 1000-point anchor.
            const m = CRITERIA.map((key) =>
                absolute ? z[key] : membership(z[key])
            );
            const integral = choquetIntegral(m, densities, lambda.value);
            const dims = {};
            for (const key of CRITERIA) {
                dims[key] = absolute
                    ? Math.round(z[key] * scale * 10) / 10
                    : Math.round(clamp01(z[key]) * scale);
            }

            scores.set(metric.userId, {
                score: absolute
                    ? Math.round(integral * scale * 10) / 10
                    : Math.round(integral * scale),
                dimensions: dims,
                raw: rawOf(metric),
                displayName: metric.displayName
            });
        }

        return scores;
    });

    function rawOf(metric) {
        return {
            totalTime: metric.totalTime,
            joinCount: metric.joinCount,
            firstSeen: metric.firstSeen,
            lastSeen: metric.lastSeen,
            distinctDays: metric.distinctDays,
            activeWeeks: metric.activeWeeks || 0,
            time30d: metric.time30d || 0,
            timePrev30d: metric.timePrev30d || 0,
            time90d: metric.time90d || 0,
            friendNumber: metric.friendNumber || 0,
            friendInitiated: metric.friendInitiated || 0,
            selfInitiated: metric.selfInitiated || 0
        };
    }

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
        lambda.value = DEFAULT_LAMBDA;
        configRepository.setObject(WEIGHTS_CONFIG_KEY, { ...weights.value });
        configRepository.setObject(LAMBDA_CONFIG_KEY, lambda.value);
    }

    function setLambda(value) {
        if (!Number.isFinite(value)) return;
        lambda.value = Math.min(LAMBDA_MAX, Math.max(LAMBDA_MIN, value));
        configRepository.setObject(LAMBDA_CONFIG_KEY, lambda.value);
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
        lambda,
        excludedUserIds,
        excludeMode,
        excludedFriends,
        setWeight,
        resetWeights,
        setLambda,
        excludeFriend,
        includeFriend,
        includeAllFriends,
        setExcludeMode,
        setScoreMode
    };
}
