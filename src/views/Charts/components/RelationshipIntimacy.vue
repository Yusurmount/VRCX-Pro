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

            <div v-if="isLoading" class="mt-[100px] flex items-center justify-center">
                <RefreshCcw class="size-6 animate-spin text-muted-foreground" />
            </div>

            <div
                v-else-if="!topFriends.length"
                class="mt-[100px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <DataTableEmpty type="nodata" />
            </div>

            <template v-else>
                <div class="mt-4 flex flex-col gap-6 px-4 pb-6">
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
                                <span class="text-[10px] text-muted-foreground">{{ bucket.range }}</span>
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
                                                    :style="{ width: friend.score + '%' }" />
                                            </div>
                                            <span class="w-8 text-right text-xs tabular-nums text-muted-foreground">{{ friend.score }}</span>
                                        </div>
                                    </div>
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
                                                        width: getScoreForFriend(friend.userId).dimensions[dim.key] + '%',
                                                        backgroundColor: dim.color
                                                    }" />
                                            </div>
                                            <span class="text-xs tabular-nums text-right">
                                                {{ getScoreForFriend(friend.userId).dimensions[dim.key] }}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup>
    import { ref, watch } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { RefreshCcw, Info, ChevronDown } from 'lucide-vue-next';

    import BackToTop from '@/components/BackToTop.vue';
    import DataTableEmpty from '@/components/ui/data-table/DataTableEmpty.vue';
    import HoverCard from '@/components/ui/hover-card/HoverCard.vue';
    import HoverCardTrigger from '@/components/ui/hover-card/HoverCardTrigger.vue';
    import HoverCardContent from '@/components/ui/hover-card/HoverCardContent.vue';
    import Button from '@/components/ui/button/Button.vue';
    import TooltipWrapper from '@/components/ui/tooltip/TooltipWrapper.vue';

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
        scoreDistribution
    } = useRelationshipScoring();

    const containerRef = ref(null);
    const selectedFriend = ref(null);

    function getUser(userId) {
        return userStore.cachedUsers.get(userId) || { displayName: '' };
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
