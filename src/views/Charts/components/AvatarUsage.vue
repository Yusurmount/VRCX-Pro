<template>
    <div id="chart" class="x-container">
        <div ref="avatarUsageRef" class="pt-4">
            <BackToTop :target="avatarUsageRef" :right="30" :bottom="30" :teleport="false" />
            <div class="options-container mt-0 flex items-center justify-between">
                <div class="flex items-center gap-2 mb-4">
                    <span class="shrink-0">{{ t('view.charts.avatar_usage.header') }}</span>
                    <HoverCard>
                        <HoverCardTrigger as-child>
                            <Info class="ml-1 text-xs opacity-70" />
                        </HoverCardTrigger>
                        <HoverCardContent side="bottom" align="start" class="w-75">
                            <div class="text-xs">
                                {{ t('view.charts.avatar_usage.tips.description') }}
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                </div>
                <div class="flex items-center gap-2">
                    <ToggleGroup variant="outline" type="single" :model-value="String(selectedDays)" @update:modelValue="handleDaysChange">
                        <ToggleGroupItem value="7">{{ t('view.charts.avatar_usage.period.days_7') }}</ToggleGroupItem>
                        <ToggleGroupItem value="30">{{ t('view.charts.avatar_usage.period.days_30') }}</ToggleGroupItem>
                        <ToggleGroupItem value="90">{{ t('view.charts.avatar_usage.period.days_90') }}</ToggleGroupItem>
                    </ToggleGroup>
                </div>
            </div>
            <div v-if="isLoading" class="mt-[100px] flex items-center justify-center">
                <RefreshCcw class="size-6 animate-spin text-muted-foreground" />
            </div>
            <div v-else-if="!hasData" class="mt-[100px] flex items-center justify-center">
                <DataTableEmpty type="nodata" />
            </div>
            <template v-else>
                <div class="mx-auto mt-3 flex max-w-[1100px] items-center gap-3">
                    <div class="flex items-center gap-2 rounded-lg border px-3 py-2">
                        <RefreshCcw class="size-3.5 text-muted-foreground" />
                        <span class="text-sm font-medium">{{ stats.totalChanges.toLocaleString() }}</span>
                        <span class="text-xs text-muted-foreground">{{ t('view.charts.avatar_usage.stats.total_changes') }}</span>
                    </div>
                    <div v-if="stats.topAvatars.length > 0" class="flex items-center gap-2 rounded-lg border px-3 py-2">
                        <Star class="size-3.5 text-yellow-500/50" />
                        <span class="text-sm font-medium">{{ stats.topAvatars[0]?.avatarName }}</span>
                        <span class="text-xs text-muted-foreground">{{ t('view.charts.avatar_usage.stats.top_avatar') }}</span>
                    </div>
                    <div v-if="avgDailyChanges > 0" class="flex items-center gap-2 rounded-lg border px-3 py-2">
                        <TrendingUp class="size-3.5 text-green-500/50" />
                        <span class="text-sm font-medium">{{ avgDailyChanges.toFixed(1) }}</span>
                        <span class="text-xs text-muted-foreground">{{ t('view.charts.avatar_usage.stats.avg_daily') }}</span>
                    </div>
                </div>
                <div class="mx-auto mt-4 max-w-[1100px] grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div class="rounded-lg border p-4">
                        <h3 class="mb-3 text-sm font-medium">{{ t('view.charts.avatar_usage.charts.change_frequency') }}</h3>
                        <div ref="changeFrequencyChartRef" style="width: 100%; height: 280px" />
                    </div>
                    <div class="rounded-lg border p-4">
                        <h3 class="mb-3 text-sm font-medium">{{ t('view.charts.avatar_usage.charts.self_vs_other') }}</h3>
                        <div ref="selfVsOtherChartRef" style="width: 100%; height: 280px" />
                    </div>
                </div>
                <div class="mx-auto mt-6 max-w-[1100px] rounded-lg border p-4">
                    <h3 class="mb-3 text-sm font-medium">{{ t('view.charts.avatar_usage.charts.top_avatars') }}</h3>
                    <div ref="topAvatarsChartRef" style="width: 100%; height: 320px" />
                </div>
                <div class="mx-auto mt-6 max-w-[1100px] rounded-lg border p-4">
                    <h3 class="mb-3 text-sm font-medium">{{ t('view.charts.avatar_usage.charts.change_timeline') }}</h3>
                    <div ref="changeTimelineChartRef" style="width: 100%; height: 240px" />
                </div>
            </template>
        </div>
    </div>
</template>
<script setup>
    defineOptions({ name: 'ChartsAvatarUsage' });

    import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
    import { Info, RefreshCcw, Star, TrendingUp } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import * as echarts from 'echarts';

    import BackToTop from '@/components/BackToTop.vue';
    import { DataTableEmpty } from '@/components/ui/data-table';
    import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
    import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

    import { database } from '@/services/database';
    import { useAppearanceSettingsStore } from '@/stores';

    const { t } = useI18n();
    const { isDarkMode } = storeToRefs(useAppearanceSettingsStore());

    const avatarUsageRef = ref(null);
    const isLoading = ref(true);
    const selectedDays = ref(30);
    const stats = ref({ topAvatars: [], selfVsOther: { selfOwned: 0, others: 0 }, totalChanges: 0, dailyChanges: [], topAuthors: [] });

    const changeFrequencyChartRef = ref(null);
    const selfVsOtherChartRef = ref(null);
    const topAvatarsChartRef = ref(null);
    const changeTimelineChartRef = ref(null);

    let changeFrequencyChart = null;
    let selfVsOtherChart = null;
    let topAvatarsChart = null;
    let changeTimelineChart = null;

    const hasData = computed(() => stats.value.totalChanges > 0);

    const avgDailyChanges = computed(() => {
        if (!stats.value.dailyChanges.length) return 0;
        const total = stats.value.dailyChanges.reduce((sum, d) => sum + d.count, 0);
        return total / stats.value.dailyChanges.length;
    });

    function getChartTheme() {
        return isDarkMode.value ? 'dark' : undefined;
    }

    function getTextColor() {
        return isDarkMode.value ? '#e5e7eb' : '#374151';
    }

    function getSubTextColor() {
        return isDarkMode.value ? '#9ca3af' : '#6b7280';
    }

    function handleDaysChange(value) {
        if (!value) return;
        selectedDays.value = parseInt(value, 10);
        loadData();
    }

    async function loadData() {
        isLoading.value = true;
        try {
            stats.value = await database.getAvatarUsageStats(selectedDays.value);
        } catch (error) {
            console.error('Error loading avatar usage stats:', error);
            stats.value = { topAvatars: [], selfVsOther: { selfOwned: 0, others: 0 }, totalChanges: 0, dailyChanges: [], topAuthors: [] };
        } finally {
            isLoading.value = false;
        }
    }

    function disposeCharts() {
        [changeFrequencyChart, selfVsOtherChart, topAvatarsChart, changeTimelineChart].forEach((chart) => {
            if (chart) chart.dispose();
        });
        changeFrequencyChart = null;
        selfVsOtherChart = null;
        topAvatarsChart = null;
        changeTimelineChart = null;
    }

    function initChangeFrequencyChart() {
        if (!changeFrequencyChartRef.value || !stats.value.dailyChanges.length) return;
        if (changeFrequencyChart) changeFrequencyChart.dispose();
        changeFrequencyChart = echarts.init(changeFrequencyChartRef.value, getChartTheme());
        changeFrequencyChart.setOption({
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: stats.value.dailyChanges.map((d) => d.date), axisLabel: { color: getSubTextColor() } },
            yAxis: { type: 'value', axisLabel: { color: getSubTextColor() } },
            series: [{ type: 'bar', data: stats.value.dailyChanges.map((d) => d.count), itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 30 }],
            grid: { left: 50, right: 20, top: 20, bottom: 40 }
        });
    }

    function initSelfVsOtherChart() {
        if (!selfVsOtherChartRef.value) return;
        if (selfVsOtherChart) selfVsOtherChart.dispose();
        selfVsOtherChart = echarts.init(selfVsOtherChartRef.value, getChartTheme());
        const { selfOwned, others } = stats.value.selfVsOther;
        selfVsOtherChart.setOption({
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            legend: { bottom: 10, textStyle: { color: getTextColor() } },
            series: [{
                type: 'pie', radius: ['40%', '70%'], avoidLabelOverlap: false,
                itemStyle: { borderRadius: 8, borderColor: isDarkMode.value ? '#1f2937' : '#fff', borderWidth: 2 },
                label: { show: true, formatter: '{b}\n{d}%', color: getTextColor() },
                data: [
                    { value: selfOwned, name: t('view.charts.avatar_usage.labels.self_owned') },
                    { value: others, name: t('view.charts.avatar_usage.labels.others') }
                ].filter((d) => d.value > 0)
            }]
        });
    }

    function initTopAvatarsChart() {
        if (!topAvatarsChartRef.value || !stats.value.topAvatars.length) return;
        if (topAvatarsChart) topAvatarsChart.dispose();
        topAvatarsChart = echarts.init(topAvatarsChartRef.value, getChartTheme());
        const top10 = stats.value.topAvatars.slice(0, 10);
        const names = top10.map((a) => a.avatarName.length > 20 ? a.avatarName.slice(0, 20) + '...' : a.avatarName);
        const counts = top10.map((a) => a.changeCount);
        topAvatarsChart.setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            xAxis: { type: 'value', axisLabel: { color: getSubTextColor() } },
            yAxis: { type: 'category', data: names.reverse(), axisLabel: { color: getTextColor(), width: 150, overflow: 'truncate' } },
            series: [{ type: 'bar', data: counts.reverse(), itemStyle: { color: '#8b5cf6', borderRadius: [0, 4, 4, 0] }, barMaxWidth: 24 }],
            grid: { left: 160, right: 30, top: 10, bottom: 20 }
        });
    }

    function initChangeTimelineChart() {
        if (!changeTimelineChartRef.value || !stats.value.dailyChanges.length) return;
        if (changeTimelineChart) changeTimelineChart.dispose();
        changeTimelineChart = echarts.init(changeTimelineChartRef.value, getChartTheme());
        changeTimelineChart.setOption({
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: stats.value.dailyChanges.map((d) => d.date), axisLabel: { color: getSubTextColor() } },
            yAxis: { type: 'value', axisLabel: { color: getSubTextColor() } },
            series: [{
                type: 'line', data: stats.value.dailyChanges.map((d) => d.count), smooth: true,
                lineStyle: { color: '#6366f1', width: 2 },
                areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(99,102,241,0.3)' }, { offset: 1, color: 'rgba(99,102,241,0.02)' }]) },
                itemStyle: { color: '#6366f1' }
            }],
            grid: { left: 50, right: 20, top: 20, bottom: 40 }
        });
    }

    function initAllCharts() {
        initChangeFrequencyChart();
        initSelfVsOtherChart();
        initTopAvatarsChart();
        initChangeTimelineChart();
    }

    const containerResizeObserver = new ResizeObserver(() => {
        changeFrequencyChart?.resize();
        selfVsOtherChart?.resize();
        topAvatarsChart?.resize();
        changeTimelineChart?.resize();
    });

    watch(isDarkMode, () => { disposeCharts(); if (hasData.value) initAllCharts(); });
    watch(() => stats.value, () => { disposeCharts(); if (hasData.value) initAllCharts(); });

    onMounted(() => {
        if (avatarUsageRef.value) containerResizeObserver.observe(avatarUsageRef.value);
        loadData();
    });

    onBeforeUnmount(() => {
        if (avatarUsageRef.value) containerResizeObserver.unobserve(avatarUsageRef.value);
        disposeCharts();
    });
</script>
