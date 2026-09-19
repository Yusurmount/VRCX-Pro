import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFriendStore, useUserStore, useFavoriteStore } from '../../../stores';
import { database } from '../../../services/database';

export function useGroupRecommendations() {
    const friendStore = useFriendStore();
    const userStore = useUserStore();
    const favoriteStore = useFavoriteStore();

    const { friends } = storeToRefs(friendStore);
    const cachedUsers = userStore.cachedUsers;

    const isLoading = ref(false);
    const recommendations = ref([]);

    const existingGroups = computed(() => {
        return favoriteStore.localFriendFavorites || {};
    });

    async function analyze() {
        isLoading.value = true;
        recommendations.value = [];

        try {
            const metrics = await database.getFriendshipMetrics();
            if (!metrics.length) return;

            const friendMetrics = metrics.filter(
                (m) => friends.value?.has?.(m.userId)
            );
            if (friendMetrics.length < 2) return;

            const maxTime = Math.max(
                ...friendMetrics.map((m) => m.totalTime),
                1
            );
            const maxJoins = Math.max(
                ...friendMetrics.map((m) => m.joinCount),
                1
            );
            const maxDays = Math.max(
                ...friendMetrics.map((m) => m.distinctDays),
                1
            );

            const normalizedMetrics = friendMetrics.map((m) => ({
                ...m,
                normTime: m.totalTime / maxTime,
                normJoins: m.joinCount / maxJoins,
                normDays: m.distinctDays / maxDays
            }));

            const groups = existingGroups.value;
            const groupMembership = new Map();
            for (const [groupName, userIds] of Object.entries(groups)) {
                for (const uid of userIds) {
                    if (!groupMembership.has(uid))
                        groupMembership.set(uid, []);
                    groupMembership.get(uid).push(groupName);
                }
            }

            const newRecs = [];
            const processed = new Set();

            for (let i = 0; i < normalizedMetrics.length; i++) {
                for (let j = i + 1; j < normalizedMetrics.length; j++) {
                    const a = normalizedMetrics[i];
                    const b = normalizedMetrics[j];

                    const dotProduct =
                        a.normTime * b.normTime +
                        a.normJoins * b.normJoins +
                        a.normDays * b.normDays;
                    const magA = Math.sqrt(
                        a.normTime ** 2 +
                            a.normJoins ** 2 +
                            a.normDays ** 2
                    );
                    const magB = Math.sqrt(
                        b.normTime ** 2 +
                            b.normJoins ** 2 +
                            b.normDays ** 2
                    );
                    const similarity =
                        magA && magB ? dotProduct / (magA * magB) : 0;

                    if (similarity < 0.7) continue;

                    const groupsA = groupMembership.get(a.userId) || [];
                    const groupsB = groupMembership.get(b.userId) || [];
                    const sharedGroups = groupsA.filter((g) =>
                        groupsB.includes(g)
                    );
                    const key = [a.userId, b.userId].sort().join('|');

                    if (processed.has(key)) continue;
                    processed.add(key);

                    const nameA =
                        a.displayName ||
                        cachedUsers.get(a.userId)?.displayName ||
                        a.userId;
                    const nameB =
                        b.displayName ||
                        cachedUsers.get(b.userId)?.displayName ||
                        b.userId;

                    if (
                        sharedGroups.length === 0 &&
                        groupsA.length > 0 &&
                        groupsB.length > 0
                    ) {
                        newRecs.push({
                            type: 'merge',
                            friendIds: [a.userId, b.userId],
                            friendNames: [nameA, nameB],
                            sourceGroups: [
                                ...new Set([...groupsA, ...groupsB])
                            ],
                            similarity: Math.round(similarity * 100),
                            reason: 'similar_pattern',
                            confidence: similarity
                        });
                    } else if (
                        sharedGroups.length === 0 &&
                        groupsA.length === 0 &&
                        groupsB.length === 0
                    ) {
                        newRecs.push({
                            type: 'suggest_group',
                            friendIds: [a.userId, b.userId],
                            friendNames: [nameA, nameB],
                            similarity: Math.round(similarity * 100),
                            reason: 'no_group_high_similarity',
                            confidence: similarity
                        });
                    }
                }
            }

            recommendations.value = newRecs
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 15);
        } catch (err) {
            console.error('[useGroupRecommendations] Analysis failed', err);
        } finally {
            isLoading.value = false;
        }
    }

    function dismissRecommendation(index) {
        recommendations.value.splice(index, 1);
    }

    return {
        isLoading,
        recommendations,
        existingGroups,
        analyze,
        dismissRecommendation
    };
}
