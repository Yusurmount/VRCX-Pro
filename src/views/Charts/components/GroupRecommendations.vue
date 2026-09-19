<template>
    <div id="chart" class="x-container flex h-full min-h-0 flex-col">
        <div ref="containerRef" class="flex min-h-0 flex-1 flex-col pt-4">
            <BackToTop :target="containerRef" :right="30" :bottom="30" :teleport="false" />

            <div class="options-container mt-0 flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                    <span class="shrink-0">{{ t('view.charts.group_recommendations.header') }}</span>
                    <HoverCard>
                        <HoverCardTrigger as-child>
                            <Info class="ml-1 text-xs opacity-70" />
                        </HoverCardTrigger>
                        <HoverCardContent side="bottom" align="start" class="w-80">
                            <div class="text-xs">
                                {{ t('view.charts.group_recommendations.tips.description') }}
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                </div>
                <div class="flex items-center gap-2">
                    <TooltipWrapper :content="t('view.charts.group_recommendations.analyze_tooltip')" side="top">
                        <Button :disabled="isLoading" @click="analyze">
                            <Spinner v-if="isLoading" class="mr-2" />
                            {{ t('view.charts.group_recommendations.analyze') }}
                        </Button>
                    </TooltipWrapper>
                </div>
            </div>

            <div v-if="isLoading && !recommendations.length" class="mt-[100px] flex items-center justify-center">
                <RefreshCcw class="size-6 animate-spin text-muted-foreground" />
            </div>

            <div
                v-else-if="!recommendations.length && !isLoading"
                class="mt-[100px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <DataTableEmpty type="nodata" />
                <span class="text-sm">{{ t('view.charts.group_recommendations.empty_hint') }}</span>
            </div>

            <div v-else class="mt-4 space-y-3 px-4 pb-6">
                <div
                    v-for="(rec, idx) in recommendations"
                    :key="idx"
                    class="rounded-lg border bg-card p-4">
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <div class="flex -space-x-2">
                                <div
                                    v-for="(name, nameIdx) in rec.friendNames"
                                    :key="nameIdx"
                                    class="relative size-9 flex-none rounded-full border-2 border-background">
                                    <img
                                        class="size-full rounded-full object-cover"
                                        :src="userImage(getUser(rec.friendIds[nameIdx]), true)"
                                        loading="lazy" />
                                </div>
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="text-sm font-medium">
                                        {{ rec.friendNames.join(' & ') }}
                                    </span>
                                    <span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                        {{ t('view.charts.group_recommendations.similarity') }}: {{ rec.similarity }}%
                                    </span>
                                </div>
                                <div class="mt-1 text-xs text-muted-foreground">
                                    <template v-if="rec.type === 'merge'">
                                        {{ t('view.charts.group_recommendations.reason_merge') }}
                                        <span
                                            v-for="(g, gIdx) in rec.sourceGroups"
                                            :key="gIdx"
                                            class="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs mr-1">
                                            {{ g }}
                                        </span>
                                    </template>
                                    <template v-else>
                                        {{ t('view.charts.group_recommendations.reason_no_group') }}
                                    </template>
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            class="shrink-0 size-8"
                            @click="dismissRecommendation(idx)">
                            <X class="size-4 text-muted-foreground" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
    import { ref } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { RefreshCcw, Info, X } from 'lucide-vue-next';

    import BackToTop from '@/components/BackToTop.vue';
    import Button from '@/components/ui/button/Button.vue';
    import DataTableEmpty from '@/components/ui/data-table/DataTableEmpty.vue';
    import HoverCard from '@/components/ui/hover-card/HoverCard.vue';
    import HoverCardTrigger from '@/components/ui/hover-card/HoverCardTrigger.vue';
    import HoverCardContent from '@/components/ui/hover-card/HoverCardContent.vue';
    import TooltipWrapper from '@/components/ui/tooltip/TooltipWrapper.vue';
    import Spinner from '@/components/ui/spinner/Spinner.vue';

    import { useUserStore } from '../../../stores';
    import { useUserDisplay } from '../../../composables/useUserDisplay';
    import { useGroupRecommendations } from '../composables/useGroupRecommendations';

    const { t } = useI18n();
    const userStore = useUserStore();
    const { userImage } = useUserDisplay();

    const {
        isLoading,
        recommendations,
        analyze,
        dismissRecommendation
    } = useGroupRecommendations();

    const containerRef = ref(null);

    function getUser(userId) {
        return userStore.cachedUsers.get(userId) || { displayName: '' };
    }
</script>
