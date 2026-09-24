<template>
    <div id="chart" ref="containerRef" class="x-container flex h-full min-h-0 flex-col">
        <div class="flex min-h-0 flex-1 flex-col pt-4">
            <BackToTop :target="containerRef" :right="30" :bottom="30" :teleport="false" />

            <div class="options-container mt-0 flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                    <span class="shrink-0">{{ t('view.charts.timeline_comparison.header') }}</span>
                    <HoverCard>
                        <HoverCardTrigger as-child>
                            <Info class="ml-1 text-xs opacity-70" />
                        </HoverCardTrigger>
                        <HoverCardContent side="bottom" align="start" class="w-80">
                            <div class="text-xs">
                                {{ t('view.charts.timeline_comparison.tips.description') }}
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                </div>
            </div>

            <div class="flex items-center gap-2 px-4 pb-2">
                <div class="min-w-0 flex-1">
                    <VirtualCombobox
                        :model-value="selectedFriendAId"
                        @update:modelValue="handleFriendASelect"
                        :groups="friendPickerGroups"
                        :placeholder="t('view.charts.timeline_comparison.select_friend_a')"
                        :search-placeholder="t('view.charts.timeline_comparison.search_friend')"
                        :close-on-select="true"
                        :deselect-on-reselect="true">
                        <template #item="{ item, selected }">
                            <div class="flex w-full items-center p-1.5 text-[13px]">
                                <template v-if="item.user">
                                    <div
                                        class="relative mr-2.5 inline-block size-9 flex-none"
                                        :class="userStatusClass(item.user)">
                                        <img
                                            class="size-full rounded-full object-cover"
                                            :src="userImage(item.user, true)"
                                            loading="lazy" />
                                    </div>
                                        <div class="min-w-0 flex-1 overflow-hidden">
                                            <span
                                                class="block truncate font-medium leading-[18px]"
                                                :style="{ color: item.user.$userColour }">
                                            {{ item.user.displayName }}
                                        </span>
                                    </div>
                                </template>
                                <template v-else>
                                    <span>{{ item.label }}</span>
                                </template>
                                <Check :class="['ml-auto size-4', selected ? 'opacity-100' : 'opacity-0']" />
                            </div>
                        </template>
                    </VirtualCombobox>
                </div>

                <TooltipWrapper :content="t('view.charts.timeline_comparison.swap_friends')" side="top">
                    <Button
                        class="shrink-0 rounded-full"
                        size="icon"
                        variant="ghost"
                        :disabled="!selectedFriendAId && !selectedFriendBId"
                        @click="swapFriends">
                        <ArrowLeftRight class="size-4" />
                    </Button>
                </TooltipWrapper>

                <div class="min-w-0 flex-1">
                    <VirtualCombobox
                        :model-value="selectedFriendBId"
                        @update:modelValue="handleFriendBSelect"
                        :groups="friendPickerGroups"
                        :placeholder="t('view.charts.timeline_comparison.select_friend_b')"
                        :search-placeholder="t('view.charts.timeline_comparison.search_friend')"
                        :close-on-select="true"
                        :deselect-on-reselect="true">
                        <template #item="{ item, selected }">
                            <div class="flex w-full items-center p-1.5 text-[13px]">
                                <template v-if="item.user">
                                    <div
                                        class="relative mr-2.5 inline-block size-9 flex-none"
                                        :class="userStatusClass(item.user)">
                                        <img
                                            class="size-full rounded-full object-cover"
                                            :src="userImage(item.user, true)"
                                            loading="lazy" />
                                    </div>
                                    <div class="min-w-0 flex-1 overflow-hidden">
                                        <span
                                            class="block truncate font-medium leading-[18px]"
                                            :style="{ color: item.user.$userColour }">
                                            {{ item.user.displayName }}
                                        </span>
                                    </div>
                                </template>
                                <template v-else>
                                    <span>{{ item.label }}</span>
                                </template>
                                <Check :class="['ml-auto size-4', selected ? 'opacity-100' : 'opacity-0']" />
                            </div>
                        </template>
                    </VirtualCombobox>
                </div>
            </div>

            <div v-if="isLoading" class="mt-[100px] flex items-center justify-center">
                <RefreshCcw class="size-6 animate-spin text-muted-foreground" />
            </div>

            <div
                v-else-if="!trendSummary"
                class="mt-[100px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <DataTableEmpty type="nodata" />
            </div>

            <template v-else>
                <div class="px-4 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div class="rounded-lg border bg-card p-3">
                        <div class="text-xs text-muted-foreground">{{ t('view.charts.timeline_comparison.momentum') }}</div>
                        <div :class="['mt-1 text-sm font-medium', momentumClass]">{{ momentumLabel }}</div>
                    </div>
                    <div class="rounded-lg border bg-card p-3">
                        <div class="text-xs text-muted-foreground">{{ t('view.charts.timeline_comparison.peak_month') }}</div>
                        <div class="mt-1 text-sm font-medium">{{ trendSummary.peakMonth || '-' }}</div>
                    </div>
                    <div class="rounded-lg border bg-card p-3">
                        <div class="text-xs text-muted-foreground">{{ t('view.charts.timeline_comparison.total_encounters') }}</div>
                        <div class="mt-1 text-sm font-medium tabular-nums">{{ trendSummary.totalVisits }}</div>
                    </div>
                    <div class="rounded-lg border bg-card p-3">
                        <div class="text-xs text-muted-foreground">{{ t('view.charts.timeline_comparison.total_months') }}</div>
                        <div class="mt-1 text-sm font-medium tabular-nums">{{ trendSummary.totalMonths }}</div>
                    </div>
                </div>

                <div class="relative mt-2 flex min-h-0 flex-1 flex-col px-4">
                    <div
                        ref="chartDomRef"
                        class="w-full min-h-[300px] flex-1 rounded-lg border bg-card"
                        role="img"
                        :aria-label="t('view.charts.timeline_comparison.chart_label')">
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup>
    import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import * as echarts from 'echarts';
    import { RefreshCcw, Info, Check, ArrowLeftRight } from 'lucide-vue-next';

    import BackToTop from '@/components/BackToTop.vue';
    import Button from '@/components/ui/button/Button.vue';
    import DataTableEmpty from '@/components/ui/data-table/DataTableEmpty.vue';
    import HoverCard from '@/components/ui/hover-card/HoverCard.vue';
    import HoverCardTrigger from '@/components/ui/hover-card/HoverCardTrigger.vue';
    import HoverCardContent from '@/components/ui/hover-card/HoverCardContent.vue';
    import TooltipWrapper from '@/components/ui/tooltip/TooltipWrapper.vue';
    import { VirtualCombobox } from '@/components/ui/virtual-combobox';

    import {
        useAppearanceSettingsStore,
        useFriendStore,
        useUserStore
    } from '../../../stores';
    import { useUserDisplay } from '../../../composables/useUserDisplay';
    import { useTimelineComparison } from '../composables/useTimelineComparison';

    const { t } = useI18n();
    const friendStore = useFriendStore();
    const userStore = useUserStore();
    const appearanceStore = useAppearanceSettingsStore();
    const { friends } = storeToRefs(friendStore);
    const { currentUser } = storeToRefs(userStore);
    const { isDarkMode } = storeToRefs(appearanceStore);
    const { userImage, userStatusClass } = useUserDisplay();

    const {
        isLoading,
        monthlyTimeline,
        trendSummary,
        loadTimeline
    } = useTimelineComparison();

    const containerRef = ref(null);
    const chartDomRef = ref(null);
    const selectedFriendAId = ref(null);
    const selectedFriendBId = ref(null);

    let echartsInstance = null;
    let resizeObserver = null;

    const friendPickerGroups = computed(() => {
        const sortedFriends = Array.from(friends.value.values()).sort(
            (a, b) =>
                (a.ref?.displayName || '').localeCompare(
                    b.ref?.displayName || ''
                )
        );
        return [
            {
                label: t('view.charts.timeline_comparison.friends'),
                items: sortedFriends.map((f) => ({
                    value: f.id,
                    label: f.ref?.displayName || f.id,
                    user: f.ref
                }))
            }
        ];
    });

    const momentumClass = computed(() => {
        if (!trendSummary.value) return '';
        const m = trendSummary.value.momentum;
        if (m === 'growing') return 'text-green-600 dark:text-green-400';
        if (m === 'declining') return 'text-red-600 dark:text-red-400';
        return 'text-muted-foreground';
    });

    const momentumLabel = computed(() => {
        if (!trendSummary.value) return '';
        const m = trendSummary.value.momentum;
        if (m === 'growing') return t('view.charts.timeline_comparison.momentum_growing');
        if (m === 'declining') return t('view.charts.timeline_comparison.momentum_declining');
        return t('view.charts.timeline_comparison.momentum_stable');
    });

    function handleFriendASelect(friendId) {
        selectedFriendAId.value = friendId || null;
        if (friendId && selectedFriendBId.value) {
            loadTimeline(friendId, selectedFriendBId.value);
        }
    }

    function handleFriendBSelect(friendId) {
        selectedFriendBId.value = friendId || null;
        if (friendId && selectedFriendAId.value) {
            loadTimeline(selectedFriendAId.value, friendId);
        }
    }

    function swapFriends() {
        const tmp = selectedFriendAId.value;
        selectedFriendAId.value = selectedFriendBId.value;
        selectedFriendBId.value = tmp;
        if (selectedFriendAId.value && selectedFriendBId.value) {
            loadTimeline(selectedFriendAId.value, selectedFriendBId.value);
        }
    }

    function disposeChart() {
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
        if (echartsInstance) {
            echartsInstance.dispose();
            echartsInstance = null;
        }
    }

    function initChart() {
        if (!chartDomRef.value) return;
        disposeChart();

        echartsInstance = echarts.init(
            chartDomRef.value,
            isDarkMode.value ? 'dark' : null,
            { renderer: 'canvas' }
        );

        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                echartsInstance?.resize({
                    width: entry.contentRect.width
                });
            }
        });
        resizeObserver.observe(chartDomRef.value);

        updateChart();
    }

    function updateChart() {
        if (!echartsInstance) return;
        const timeline = monthlyTimeline.value;
        if (!timeline.months.length) return;

        const textColor = isDarkMode.value ? '#e2e8f0' : '#374151';
        const borderColor = isDarkMode.value ? '#334155' : '#e5e7eb';

        echartsInstance.setOption(
            {
                tooltip: {
                    trigger: 'axis',
                    axisPointer: { type: 'shadow' },
                    formatter(params) {
                        if (!params?.length) return '';
                        const month = params[0].axisValue;
                        let html = '<div class="font-medium">' + month + '</div>';
                        for (const p of params) {
                            const mins = Math.round(p.value / 60000);
                            html +=
                                '<div>' +
                                p.seriesName +
                                ': ' +
                                mins +
                                ' ' +
                                t('view.charts.timeline_comparison.co_time_minutes') +
                                '</div>';
                        }
                        return html;
                    }
                },
                grid: {
                    left: 60,
                    right: 20,
                    top: 30,
                    bottom: 40
                },
                xAxis: {
                    type: 'category',
                    data: timeline.months,
                    axisLabel: { color: textColor, fontSize: 10, rotate: 45 },
                    axisLine: { lineStyle: { color: borderColor } }
                },
                yAxis: {
                    type: 'value',
                    name: t('view.charts.timeline_comparison.co_time_minutes'),
                    axisLabel: {
                        color: textColor,
                        formatter: (v) => Math.round(v / 60000)
                    },
                    splitLine: { lineStyle: { color: borderColor } },
                    axisLine: { lineStyle: { color: borderColor } }
                },
                series: [
                    {
                        name: t('view.charts.timeline_comparison.co_presence'),
                        type: 'bar',
                        data: timeline.data.map((d) => d.totalTime),
                        itemStyle: {
                            color: new echarts.graphic.LinearGradient(
                                0,
                                0,
                                0,
                                1,
                                [
                                    { offset: 0, color: '#5470c6' },
                                    { offset: 1, color: '#91cc75' }
                                ]
                            ),
                            borderRadius: [4, 4, 0, 0]
                        },
                        barMaxWidth: 40
                    },
                    {
                        name: t('view.charts.timeline_comparison.visits'),
                        type: 'line',
                        yAxisIndex: 0,
                        data: timeline.data.map((d) => d.visitCount * 60000),
                        smooth: true,
                        symbol: 'circle',
                        symbolSize: 6,
                        lineStyle: { color: '#fac858', width: 2 },
                        itemStyle: { color: '#fac858' }
                    }
                ]
            },
            { notMerge: true }
        );
    }

    watch(isDarkMode, () => {
        if (echartsInstance) {
            disposeChart();
            initChart();
        }
    });

    watch(trendSummary, (val) => {
        if (val) {
            nextTick(() => initChart());
        }
    });

    watch(monthlyTimeline, () => {
        if (echartsInstance) updateChart();
    });

    watch([() => currentUser.value?.id, friends], ([userId]) => {
        if (!userId) return;
        if (selectedFriendAId.value && selectedFriendBId.value) return;
        const friendList = Array.from(friends.value?.keys() || []);
        if (friendList.length >= 2) {
            selectedFriendAId.value = friendList[0];
            selectedFriendBId.value = friendList[1];
            loadTimeline(friendList[0], friendList[1]);
        }
    }, { immediate: true });

    onBeforeUnmount(() => {
        disposeChart();
    });
</script>
