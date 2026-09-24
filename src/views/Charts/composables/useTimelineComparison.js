import { ref, computed } from 'vue';
import dayjs from 'dayjs';
import { useUserStore } from '../../../stores';
import { database } from '../../../services/database';

export function useTimelineComparison() {
    const userStore = useUserStore();
    const isLoading = ref(false);
    const rawResults = ref([]);
    const friendAId = ref(null);
    const friendBId = ref(null);

    const sharedInstances = computed(() => {
        if (!rawResults.value.length) return [];
        const grouped = new Map();
        for (const row of rawResults.value) {
            const leaveA = new Date(row.friendALeave).getTime();
            const timeA = row.friendATime || 0;
            const leaveB = new Date(row.friendBLeave).getTime();
            const timeB = row.friendBTime || 0;
            const overlapStart = Math.max(leaveA - timeA, leaveB - timeB);
            const overlapEnd = Math.min(leaveA, leaveB);
            const coexistenceTime = Math.max(0, overlapEnd - overlapStart);

            if (grouped.has(row.location)) {
                const existing = grouped.get(row.location);
                existing.coexistenceTime += coexistenceTime;
                existing.visitCount += 1;
                if (leaveA > existing.lastInteraction) {
                    existing.lastInteraction = leaveA;
                    existing.formattedDate = dayjs(leaveA).format('YYYY-MM-DD');
                }
            } else {
                grouped.set(row.location, {
                    location: row.location,
                    coexistenceTime,
                    visitCount: 1,
                    lastInteraction: leaveA,
                    formattedDate: dayjs(leaveA).format('YYYY-MM-DD')
                });
            }
        }
        return Array.from(grouped.values()).sort(
            (a, b) => b.lastInteraction - a.lastInteraction
        );
    });

    const monthlyTimeline = computed(() => {
        if (!sharedInstances.value.length) return { months: [], data: [] };

        const monthMap = new Map();
        for (const inst of sharedInstances.value) {
            const month = dayjs(inst.lastInteraction).format('YYYY-MM');
            if (!monthMap.has(month)) {
                monthMap.set(month, { totalTime: 0, visitCount: 0 });
            }
            const entry = monthMap.get(month);
            entry.totalTime += inst.coexistenceTime;
            entry.visitCount += inst.visitCount;
        }

        const sorted = Array.from(monthMap.entries()).sort((a, b) =>
            a[0].localeCompare(b[0])
        );
        return {
            months: sorted.map(([m]) => m),
            data: sorted.map(([, v]) => v)
        };
    });

    const trendSummary = computed(() => {
        const timeline = monthlyTimeline.value;
        if (!timeline.months.length) return null;

        const data = timeline.data;
        const mid = Math.floor(data.length / 2);
        const firstHalf = data.slice(0, mid);
        const secondHalf = data.slice(mid);

        const firstTotal = firstHalf.reduce((s, d) => s + d.totalTime, 0);
        const secondTotal = secondHalf.reduce((s, d) => s + d.totalTime, 0);

        let momentum = 'stable';
        if (secondTotal > firstTotal * 1.2) momentum = 'growing';
        else if (secondTotal < firstTotal * 0.8) momentum = 'declining';

        let peakIdx = 0;
        for (let i = 1; i < data.length; i++) {
            if (data[i].totalTime > data[peakIdx].totalTime) peakIdx = i;
        }

        return {
            momentum,
            peakMonth: timeline.months[peakIdx],
            totalMonths: data.length,
            totalCoexistence: data.reduce((s, d) => s + d.totalTime, 0),
            totalVisits: data.reduce((s, d) => s + d.visitCount, 0),
            firstHalfAvg: firstHalf.length ? firstTotal / firstHalf.length : 0,
            secondHalfAvg: secondHalf.length ? secondTotal / secondHalf.length : 0
        };
    });

    async function loadTimeline(userIdA, userIdB) {
        if (!userIdA || !userIdB) return;
        isLoading.value = true;
        friendAId.value = userIdA;
        friendBId.value = userIdB;
        rawResults.value = [];
        try {
            const contextReady = await database.ensureUserContext(
                userStore.currentUser?.id
            );
            if (!contextReady) {
                rawResults.value = [];
                return;
            }
            rawResults.value = await database.getCoInstanceHistoryBetweenFriends(
                userIdA,
                userIdB
            );
        } catch (err) {
            console.error('[useTimelineComparison] Failed to load timeline', err);
            rawResults.value = [];
        } finally {
            isLoading.value = false;
        }
    }

    return {
        isLoading,
        rawResults,
        friendAId,
        friendBId,
        sharedInstances,
        monthlyTimeline,
        trendSummary,
        loadTimeline
    };
}
