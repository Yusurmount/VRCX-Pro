<template>
    <div id="chart" class="x-container flex h-full min-h-0 flex-col">
        <div ref="containerRef" class="flex min-h-0 flex-1 flex-col pt-4">
            <BackToTop :target="containerRef" :right="30" :bottom="30" :teleport="false" />

            <div class="options-container mt-0 flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                    <span class="shrink-0">{{ t('view.charts.intimacy.header') }}</span>
                    <HoverCard>
                        <HoverCardTrigger as-child>
                            <Info class="ml-1 text-xs opacity-70" />
                        </HoverCardTrigger>
                        <HoverCardContent side="bottom" align="start" class="w-80">
                            <div class="text-xs">
                                {{ t('view.charts.intimacy.tips.description') }}
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                </div>
                <div class="flex items-center gap-2">
                    <Sheet>
                        <SheetTrigger as-child>
                            <div>
                                <TooltipWrapper
                                    :content="t('view.charts.intimacy.settings.title')"
                                    side="top">
                                    <Button class="rounded-full" size="icon" variant="ghost">
                                        <SlidersHorizontal />
                                    </Button>
                                </TooltipWrapper>
                            </div>
                        </SheetTrigger>
                        <SheetContent side="right" class="w-90">
                            <SheetHeader>
                                <SheetTitle>{{ t('view.charts.intimacy.settings.title') }}</SheetTitle>
                            </SheetHeader>

                            <FieldGroup class="mt-4 gap-4 p-4">
                                <Field>
                                    <FieldLabel>{{ t('view.charts.intimacy.score_mode.title') }}</FieldLabel>
                                    <FieldContent>
                                        <Tabs
                                            :model-value="scoreMode"
                                            @update:model-value="setScoreMode">
                                            <TabsList class="grid w-full grid-cols-2">
                                                <TabsTrigger value="percent">
                                                    {{ t('view.charts.intimacy.score_mode.percent') }}
                                                </TabsTrigger>
                                                <TabsTrigger value="absolute">
                                                    {{ t('view.charts.intimacy.score_mode.absolute') }}
                                                </TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            {{
                                                scoreMode === 'absolute'
                                                    ? t('view.charts.intimacy.score_mode.absolute_hint')
                                                    : t('view.charts.intimacy.score_mode.percent_hint')
                                            }}
                                        </p>
                                    </FieldContent>
                                </Field>
                                <div class="flex items-center justify-between gap-2">
                                    <FieldLabel>{{ t('view.charts.intimacy.weights.title') }}</FieldLabel>
                                    <Button variant="ghost" size="sm" @click="resetWeights">
                                        <RotateCcw class="mr-1 size-3.5" />
                                        {{ t('view.charts.intimacy.weights.reset') }}
                                    </Button>
                                </div>
                                <Field v-for="dim in dimensionList" :key="dim.key">
                                    <FieldLabel>{{ dim.label }}</FieldLabel>
                                    <FieldContent>
                                        <div class="flex items-center gap-3">
                                            <Slider
                                                class="flex-1"
                                                :model-value="[weights[dim.key]]"
                                                :min="0"
                                                :max="100"
                                                :step="5"
                                                :aria-label="dim.label"
                                                @update:modelValue="(v) => setWeight(dim.key, v[0])" />
                                            <span
                                                class="min-w-12 text-right text-sm text-muted-foreground tabular-nums">
                                                {{ weights[dim.key] }}
                                            </span>
                                        </div>
                                    </FieldContent>
                                </Field>
                            </FieldGroup>

                            <FieldGroup class="gap-4 p-4">
                                <Field>
                                    <FieldLabel>{{ t('view.charts.intimacy.excluded.title') }}</FieldLabel>
                                    <FieldContent>
                                        <ToggleGroup
                                            variant="outline"
                                            type="single"
                                            :model-value="excludeMode"
                                            @update:modelValue="(v) => v && setExcludeMode(v)">
                                            <ToggleGroupItem value="full">
                                                {{ t('view.charts.intimacy.excluded.mode_full') }}
                                            </ToggleGroupItem>
                                            <ToggleGroupItem value="hidden">
                                                {{ t('view.charts.intimacy.excluded.mode_hidden') }}
                                            </ToggleGroupItem>
                                        </ToggleGroup>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            {{
                                                excludeMode === 'full'
                                                    ? t('view.charts.intimacy.excluded.mode_full_hint')
                                                    : t('view.charts.intimacy.excluded.mode_hidden_hint')
                                            }}
                                        </p>
                                    </FieldContent>
                                </Field>
                                <div v-if="excludedFriends.length" class="flex flex-col gap-1">
                                    <div
                                        v-for="excluded in excludedFriends"
                                        :key="excluded.userId"
                                        class="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                                        <div class="relative inline-block size-7 flex-none">
                                            <img
                                                class="size-full rounded-full object-cover"
                                                :src="userImage(getUser(excluded.userId), true)"
                                                loading="lazy" />
                                        </div>
                                        <span class="min-w-0 flex-1 truncate text-sm">
                                            {{ excluded.displayName }}
                                        </span>
                                        <TooltipWrapper
                                            :content="t('view.charts.intimacy.excluded.include_action')"
                                            side="top">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                @click="includeFriend(excluded.userId)">
                                                <Undo2 class="size-4" />
                                            </Button>
                                        </TooltipWrapper>
                                    </div>
                                </div>
                                <p v-else class="text-xs text-muted-foreground">
                                    {{ t('view.charts.intimacy.excluded.empty') }}
                                </p>
                            </FieldGroup>
                        </SheetContent>
                    </Sheet>
                    <TooltipWrapper :content="t('view.charts.intimacy.refresh')" side="top">
                        <Button
                            class="rounded-full"
                            size="icon"
                            variant="ghost"
                            :disabled="isLoading"
                            @click="loadScores">
                            <RefreshCcw :class="['size-4', isLoading ? 'animate-spin' : '']" />
                        </Button>
                    </TooltipWrapper>
                </div>
            </div>

            <div v-if="isLoading" class="mt-[100px] flex items-center justify-center">
                <RefreshCcw class="size-6 animate-spin text-muted-foreground" />
            </div>

            <div v-else class="mt-4 flex flex-col gap-6 px-4 pb-6">
                <template v-if="topFriends.length">
                    <div class="rounded-lg border bg-card p-4">
                        <h3 class="mb-3 text-sm font-medium">{{ t('view.charts.intimacy.distribution') }}</h3>
                        <div class="flex items-end gap-1 h-20">
                            <div
                                v-for="(bucket, idx) in scoreDistribution"
                                :key="idx"
                                class="flex-1 flex flex-col items-center gap-1">
                                <div
                                    class="w-full rounded-t bg-primary/70 transition-all"
                                    :style="{ height: bucket.percent + '%', minHeight: bucket.count > 0 ? '4px' : '0' }" />
                                <span class="text-[10px] whitespace-nowrap text-muted-foreground">{{ bucket.range }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="rounded-lg border bg-card">
                        <div class="px-4 py-3 border-b">
                            <h3 class="text-sm font-medium">{{ t('view.charts.intimacy.top_friends') }}</h3>
                        </div>
                        <div class="divide-y">
                            <template v-for="(friend, idx) in topFriends" :key="friend.userId">
                                <div
                                    class="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer"
                                    :class="selectedFriend === friend.userId ? 'bg-muted/70' : ''"
                                    @click="selectedFriend = selectedFriend === friend.userId ? null : friend.userId">
                                    <span class="w-6 text-right text-xs text-muted-foreground tabular-nums">{{ idx + 1 }}</span>
                                    <div class="relative inline-block size-9 flex-none">
                                        <img
                                            class="size-full rounded-full object-cover"
                                            :src="userImage(getUser(friend.userId), true)"
                                            loading="lazy" />
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <span class="block truncate text-sm font-medium">{{ friend.displayName }}</span>
                                        <div class="mt-1 flex items-center gap-2">
                                            <div class="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    class="h-full rounded-full bg-primary transition-all"
                                                    :style="{ width: toPercent(friend.score) + '%' }" />
                                            </div>
                                            <span class="min-w-9 text-right text-xs tabular-nums text-muted-foreground">{{ friend.score }}</span>
                                        </div>
                                    </div>
                                    <TooltipWrapper
                                        :content="t('view.charts.intimacy.excluded.exclude_action')"
                                        side="top">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            class="shrink-0"
                                            @click.stop="excludeFriend(friend.userId)">
                                            <EyeOff class="size-4 text-muted-foreground" />
                                        </Button>
                                    </TooltipWrapper>
                                    <ChevronDown
                                        :class="[
                                            'size-4 shrink-0 text-muted-foreground transition-transform',
                                            selectedFriend === friend.userId ? 'rotate-180' : ''
                                        ]" />
                                </div>

                                <div
                                    v-if="selectedFriend === friend.userId"
                                    class="border-t bg-muted/30 px-4 py-4">
                                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        <div v-for="dim in dimensionList" :key="dim.key" class="flex flex-col gap-1.5">
                                            <span class="text-xs text-muted-foreground">{{ dim.label }}</span>
                                            <div class="h-2 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    class="h-full rounded-full transition-all"
                                                    :style="{
                                                        width: toPercent(getScoreForFriend(friend.userId).dimensions[dim.key]) + '%',
                                                        backgroundColor: dim.color
                                                    }" />
                                            </div>
                                            <span class="text-xs tabular-nums text-right">
                                                {{ getScoreForFriend(friend.userId).dimensions[dim.key] }}{{ scoreMode === 'percent' ? '%' : '' }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </div>
                </template>

                <div
                    v-else
                    class="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                    <DataTableEmpty type="nodata" />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
    import { ref, watch } from 'vue';
    import { useI18n } from 'vue-i18n';
    import {
        RefreshCcw,
        Info,
        ChevronDown,
        RotateCcw,
        EyeOff,
        Undo2,
        SlidersHorizontal
    } from 'lucide-vue-next';

    import BackToTop from '@/components/BackToTop.vue';
    import DataTableEmpty from '@/components/ui/data-table/DataTableEmpty.vue';
    import HoverCard from '@/components/ui/hover-card/HoverCard.vue';
    import HoverCardTrigger from '@/components/ui/hover-card/HoverCardTrigger.vue';
    import HoverCardContent from '@/components/ui/hover-card/HoverCardContent.vue';
    import Button from '@/components/ui/button/Button.vue';
    import TooltipWrapper from '@/components/ui/tooltip/TooltipWrapper.vue';
    import { Slider } from '@/components/ui/slider';
    import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import {
        ToggleGroup,
        ToggleGroupItem
    } from '@/components/ui/toggle-group';
    import {
        Sheet,
        SheetContent,
        SheetHeader,
        SheetTitle,
        SheetTrigger
    } from '@/components/ui/sheet';
    import {
        Field,
        FieldContent,
        FieldGroup,
        FieldLabel
    } from '@/components/ui/field';

    import { useUserStore } from '../../../stores';
    import { useUserDisplay } from '../../../composables/useUserDisplay';
    import { useRelationshipScoring } from '../composables/useRelationshipScoring';

    const { t } = useI18n();
    const userStore = useUserStore();
    const { userImage } = useUserDisplay();

    const {
        isLoading,
        loadScores,
        getScoreForFriend,
        topFriends,
        scoreDistribution,
        scoreMax,
        scoreMode,
        weights,
        excludeMode,
        excludedFriends,
        setWeight,
        resetWeights,
        excludeFriend,
        includeFriend,
        setExcludeMode,
        setScoreMode
    } = useRelationshipScoring();

    const containerRef = ref(null);
    const selectedFriend = ref(null);

    function getUser(userId) {
        return userStore.cachedUsers.get(userId) || { displayName: '' };
    }

    function toPercent(value) {
        return Math.min(100, Math.round((value / scoreMax.value) * 100));
    }

    const dimensionList = [
        { key: 'onlineOverlap', label: t('view.charts.intimacy.dimension.online_overlap'), color: '#5470c6' },
        { key: 'coWorldFrequency', label: t('view.charts.intimacy.dimension.co_world_frequency'), color: '#91cc75' },
        { key: 'recency', label: t('view.charts.intimacy.dimension.recency'), color: '#fac858' },
        { key: 'consistency', label: t('view.charts.intimacy.dimension.consistency'), color: '#9a60b4' }
    ];

    watch(
        () => userStore.currentUser?.id,
        (userId) => {
            if (userId) loadScores();
        },
        { immediate: true }
    );
</script>
