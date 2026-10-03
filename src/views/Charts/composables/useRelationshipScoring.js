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
// explode the ratio when the prior window is empty. The signed display value
// is tanh(ln(ratio)/tau): 0 = flat, positive = warming, negative = cooling,
// saturating at ±1 so the bar's midpoint is zero and its ends are ±100%.
const TREND_EPS_HOURS = 0.5;
const TREND_TAU = 1.2;

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

// Percent-mode normalization: top percentile rank. Values are ordered
// ascending and every member receives the share of the cohort not strictly
// above it. Ties all get the best tied position, so a cohort that barely
// differs (everyone active 1–2 weeks) still separates, while a perfectly
// homogeneous cohort reads 100 — there is no information to separate anyone
// and nobody should be punished for it. A zero observation means "no
// presence at all" and stays 0 rather than riding a tie to the top. Rank is
// immune to whales by construction, which is what p90 log-normalization was
// doing before.
function topPercentileRanks(values) {
    const n = values.length;
    if (!n) return [];
    const order = values
        .map((v, i) => i)
        .sort((a, b) => values[a] - values[b]);
    const out = new Array(n);
    let i = 0;
    while (i < n) {
        let j = i;
        while (j + 1 < n && values[order[j + 1]] === values[order[i]]) j++;
        const rank = (j + 1) / n;
        for (let k = i; k <= j; k++) {
            out[order[k]] = values[order[k]] > 0 ? rank : 0;
        }
        i = j + 1;
    }
    return out;
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

// Physical quantities feeding the shared pipeline. Each one is an
// unbounded real-world measurement; absolute mode turns it into a log ratio
// against its anchor, percent mode into a cohort percentile rank.
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

// Signed trend: ln(ratio) is perfectly antisymmetric (doubling = −halving),
// tanh squashes it to (−1, 1) so |value| saturates at the bar's ends. The
// mid value 0.5 (from 0.5 + 0.5·theta) feeds the integral as "flat".
function trendTheta(metric) {
    return Math.tanh(Math.log(trendRatio(metric)) / TREND_TAU);
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

        // Absolute mode anchors every physical quantity at its fixed
        // standard line (log1p ratio, uncapped). Percent mode maps each
        // quantity to its top percentile rank inside this cohort. Trend is
        // exempt: it is already a self-scaled signed value (tanh of the
        // log-ratio), so neither an anchor nor a cohort rank applies.
        const contactRaw = scoredMetrics.map(contactHoursOf);
        const depthRaw = scoredMetrics.map(depthHoursOf);
        const weeksRaw = scoredMetrics.map(activeWeeksOf);
        const recencyRaw = scoredMetrics.map(recencyHoursOf);
        const activityRaw = scoredMetrics.map(activityRatio);

        const refs = absolute
            ? {
                  contact: Math.log1p(ABSOLUTE_ANCHORS.contactHours),
                  depth: Math.log1p(ABSOLUTE_ANCHORS.depthHours),
                  regularity: Math.log1p(ABSOLUTE_ANCHORS.activeWeeks),
                  recency: Math.log1p(ABSOLUTE_ANCHORS.recencyHours),
                  activity: Math.log1p(RATIO_ANCHOR)
              }
            : null;

        // Percent: one rank array per physical quantity, indexed like
        // scoredMetrics. Zero observations stay 0 (no presence, no rank).
        const ranks = absolute
            ? null
            : {
                  contact: topPercentileRanks(contactRaw),
                  depth: topPercentileRanks(depthRaw),
                  regularity: topPercentileRanks(weeksRaw),
                  recency: topPercentileRanks(recencyRaw),
                  activity: topPercentileRanks(activityRaw)
              };

        // Shrinkage target: the cohort mean rank on the relative scale (what
        // a "typical" friend looks like), the anchor on the absolute one (so
        // scores stay put when the cohort moves).
        let depthTarget = 1;
        if (!absolute) {
            depthTarget =
                ranks.depth.reduce((s, v) => s + v, 0) / ranks.depth.length;
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

        for (const [idx, metric] of scoredMetrics.entries()) {
            // Coherence: 0.5 at DEPTH_REF_MS, saturating slowly past it.
            const coherence = hill(
                metric.joinCount > 0 ? (metric.totalTime || 0) / metric.joinCount : 0,
                DEPTH_REF_MS,
                DEPTH_HILL_N
            );

            const vContact = absolute
                ? logRatio(contactRaw[idx], refs.contact)
                : ranks.contact[idx];
            const vDepth = absolute
                ? logRatio(depthRaw[idx], refs.depth)
                : ranks.depth[idx];

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
                regularity: absolute
                    ? logRatio(weeksRaw[idx], refs.regularity)
                    : ranks.regularity[idx],
                recency:
                    (absolute
                        ? logRatio(recencyRaw[idx], refs.recency)
                        : ranks.recency[idx]) * recencyModulation(metric, now),
                trend: trendTheta(metric),
                activity: absolute
                    ? logRatio(activityRaw[idx], refs.activity)
                    : ranks.activity[idx]
            };

            // Percent scale feeds the integral soft memberships; the absolute
            // scale passes the log-ratio scores through so they stay
            // uncapped — a dimension can read past its 1000-point anchor.
            // Trend is the exception on both sides: it lives in (−1, 1) and
            // enters the integral shifted to [0, 1] with 0.5 = flat, so a
            // cooling friend pulls the composite down instead of reading as
            // a positive anchor score.
            const m = CRITERIA.map((key) => {
                if (key === 'trend') {
                    const shifted = 0.5 + 0.5 * z.trend;
                    return absolute ? shifted : membership(shifted);
                }
                return absolute ? z[key] : membership(z[key]);
            });
            const integral = choquetIntegral(m, densities, lambda.value);
            const dims = {};
            for (const key of CRITERIA) {
                if (key === 'trend') {
                    // Signed display: ±100 max, 0 = flat (bar midpoint).
                    dims.trend = absolute
                        ? Math.round(z.trend * 1000) / 10
                        : Math.round(z.trend * 100);
                    continue;
                }
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
