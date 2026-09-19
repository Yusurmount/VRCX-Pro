<template>
    <div id="chart" ref="graphContainerRef" class="x-container">
        <div class="mt-0 flex min-h-[calc(100vh-140px)] flex-col items-center justify-between pt-12">
            <div class="flex items-center w-full">
                <div class="options-container flex items-center gap-3 bg-transparent pb-3 shadow-none">
                    <div>
                        <TooltipWrapper
                            v-if="isBuilding"
                            :content="t('view.charts.social_network.building_tooltip')"
                            side="top">
                            <Button variant="destructive" disabled>
                                <Spinner />
                                {{ t('view.charts.social_network.building') }}
                            </Button>
                        </TooltipWrapper>
                        <TooltipWrapper v-else :content="t('view.charts.social_network.build_tooltip')" side="top">
                            <Button @click="handleBuild">
                                {{ graph ? t('view.charts.social_network.rebuild') : t('view.charts.social_network.build') }}
                            </Button>
                        </TooltipWrapper>
                    </div>
                </div>
                <div class="ml-auto flex items-center gap-4 text-xs font-medium text-muted-foreground">
                    <div v-for="comm in communityLegend" :key="comm.id" class="flex items-center gap-1.5">
                        <div class="size-2 rounded-full" :style="{ backgroundColor: comm.color }" />
                        <span>{{ comm.label }}</span>
                    </div>
                </div>
            </div>

            <div v-if="isBuilding" class="mt-[100px] flex items-center justify-center">
                <RefreshCcw class="size-6 animate-spin text-muted-foreground" />
            </div>

            <div
                v-else-if="!graph"
                class="mt-[100px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <DataTableEmpty type="nodata" />
                <span class="text-sm">{{ t('view.charts.social_network.empty_hint') }}</span>
            </div>

            <div v-else class="flex w-full flex-1 min-h-0 gap-4 px-4">
                <div ref="sigmaContainerRef" class="flex-1 min-h-0 rounded-lg border bg-card" />

                <div class="w-56 shrink-0 space-y-3 overflow-y-auto rounded-lg border bg-card p-3 text-sm">
                    <div>
                        <h4 class="mb-1 font-medium">{{ t('view.charts.social_network.stats.title') }}</h4>
                        <div class="space-y-1 text-xs text-muted-foreground">
                            <div class="flex justify-between">
                                <span>{{ t('view.charts.social_network.stats.nodes') }}</span>
                                <span class="tabular-nums">{{ graphNodeCount }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>{{ t('view.charts.social_network.stats.edges') }}</span>
                                <span class="tabular-nums">{{ graphEdgeCount }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>{{ t('view.charts.social_network.stats.communities') }}</span>
                                <span class="tabular-nums">{{ communities.size }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>{{ t('view.charts.social_network.stats.bridges') }}</span>
                                <span class="tabular-nums">{{ bridgeNodes.length }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>{{ t('view.charts.social_network.stats.isolates') }}</span>
                                <span class="tabular-nums">{{ isolateNodes.length }}</span>
                            </div>
                        </div>
                    </div>

                    <div v-if="communityLegend.length">
                        <h4 class="mb-1 font-medium">{{ t('view.charts.social_network.community_list') }}</h4>
                        <div class="space-y-1 text-xs">
                            <div
                                v-for="comm in communityLegend"
                                :key="comm.id"
                                class="flex items-center gap-2">
                                <div class="size-2 rounded-full shrink-0" :style="{ backgroundColor: comm.color }" />
                                <span class="truncate">{{ comm.label }}</span>
                                <span class="ml-auto tabular-nums text-muted-foreground">{{ comm.count }}</span>
                            </div>
                        </div>
                    </div>

                    <div v-if="bridgeNodes.length">
                        <h4 class="mb-1 font-medium">{{ t('view.charts.social_network.bridges_title') }}</h4>
                        <div class="space-y-1 text-xs">
                            <div v-for="nodeId in bridgeNodes" :key="nodeId" class="truncate text-muted-foreground">
                                {{ getNodeLabel(nodeId) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ContextMenu v-model:open="contextMenuOpen">
                <ContextMenuTrigger as-child>
                    <div />
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem @click="handleNodeMenuViewDetails">
                        {{ t('view.charts.social_network.context_menu.view_details') }}
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        </div>
    </div>
</template>

<script setup>
    import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import { RefreshCcw } from 'lucide-vue-next';

    import { createNodeBorderProgram } from '@sigma/node-border';
    import EdgeCurveProgram from '@sigma/edge-curve';
    import Sigma from 'sigma';

    import BackToTop from '@/components/BackToTop.vue';
    import Button from '@/components/ui/button/Button.vue';
    import DataTableEmpty from '@/components/ui/data-table/DataTableEmpty.vue';
    import TooltipWrapper from '@/components/ui/tooltip/TooltipWrapper.vue';
    import Spinner from '@/components/ui/spinner/Spinner.vue';
    import ContextMenu from '@/components/ui/context-menu/ContextMenu.vue';
    import ContextMenuTrigger from '@/components/ui/context-menu/ContextMenuTrigger.vue';
    import ContextMenuContent from '@/components/ui/context-menu/ContextMenuContent.vue';
    import ContextMenuItem from '@/components/ui/context-menu/ContextMenuItem.vue';

    import {
        useAppearanceSettingsStore,
        useUserStore
    } from '../../../stores';
    import { showUserDialog } from '../../../coordinators/userCoordinator';
    import { useSocialGraph } from '../composables/useSocialGraph';

    const { t } = useI18n();
    const userStore = useUserStore();
    const appearanceStore = useAppearanceSettingsStore();
    const { isDarkMode } = storeToRefs(appearanceStore);
    const cachedUsers = userStore.cachedUsers;

    const {
        graph,
        isBuilding,
        graphNodeCount,
        graphEdgeCount,
        communities,
        bridgeNodes,
        isolateNodes,
        buildGraph,
        destroy
    } = useSocialGraph();

    const graphContainerRef = ref(null);
    const sigmaContainerRef = ref(null);
    const containerRef = ref(null);
    const contextMenuOpen = ref(false);
    const contextMenuNodeId = ref(null);

    let sigmaInstance = null;
    let resizeObserver = null;

    const communityLegend = computed(() => {
        return Array.from(communities.value.values())
            .map((c) => ({
                ...c,
                label: ${t('view.charts.social_network.community')} ,
                count: c.nodes.length
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 12);
    });

    function getNodeLabel(nodeId) {
        return cachedUsers.get(nodeId)?.displayName || nodeId;
    }

    function renderSigmaGraph(graphInstance, forceRecreate = false) {
        if (!sigmaContainerRef.value) return;
        const container = sigmaContainerRef.value;
        const { width, height } = container.getBoundingClientRect();
        if (!width || !height) return;

        const labelColor = isDarkMode.value ? '#e2e8f0' : '#111827';
        const EDGE_BASE = isDarkMode.value ? '#64748b' : '#94a3b8';
        const EDGE_ACTIVE = isDarkMode.value ? '#facc15' : '#0f172a';

        let cameraState = null;
        if (sigmaInstance && forceRecreate) {
            try {
                const cam = sigmaInstance.getCamera?.();
                cameraState = cam?.getState?.() || null;
            } catch (_) {}
            sigmaInstance.kill();
            sigmaInstance = null;
        }

        if (!sigmaInstance) {
            sigmaInstance = new Sigma(graphInstance, container, {
                allowInvalidContainer: true,
                renderLabels: true,
                labelRenderedSizeThreshold: 10,
                labelColor: { color: labelColor },
                defaultEdgeColor: EDGE_BASE,
                zIndex: true,
                defaultNodeType: 'border',
                nodeProgramClasses: { border: NodeBorderProgram },
                edgeProgramClasses: { curve: EdgeCurveProgram }
            });
        } else {
            sigmaInstance.setGraph(graphInstance);
        }

        if (cameraState) {
            try {
                const cam = sigmaInstance.getCamera?.();
                cam?.setState?.(cameraState);
            } catch (_) {}
        }

        sigmaInstance.setSetting('nodeReducer', (node, data) => {
            const res = { ...data };
            if (data.isBridge) {
                res.highlighted = true;
                res.size = (data.size || 5) + 2;
            }
            return res;
        });

        sigmaInstance.setSetting('edgeReducer', (edge, data) => {
            const res = { ...data };
            if (data.manualRelation) {
                res.color = isDarkMode.value ? '#31543d' : '#dcfce7';
                res.size = (data.size || 0.75) + 0.5;
            }
            return res;
        });

        sigmaInstance.removeAllListeners?.();
        sigmaInstance.on('clickNode', ({ node }) => {
            showUserDialog(node);
        });
        sigmaInstance.on('rightClickNode', ({ node, event }) => {
            contextMenuNodeId.value = node;
        });
    }

    async function handleBuild() {
        await buildGraph();
        await nextTick();
        if (graph.value) {
            renderSigmaGraph(graph.value, true);
        }
    }

    function handleNodeMenuViewDetails() {
        if (contextMenuNodeId.value) {
            showUserDialog(contextMenuNodeId.value);
        }
        contextMenuNodeId.value = null;
    }

    watch(isDarkMode, () => {
        if (sigmaInstance && graph.value) {
            renderSigmaGraph(graph.value, true);
        }
    });

    watch(graph, (g) => {
        if (g) {
            nextTick(() => renderSigmaGraph(g, true));
        }
    });

    onMounted(() => {
        if (sigmaContainerRef.value) {
            resizeObserver = new ResizeObserver(() => {
                if (sigmaInstance) sigmaInstance.refresh?.();
            });
            resizeObserver.observe(sigmaContainerRef.value);
        }
    });

    onBeforeUnmount(() => {
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
        if (sigmaInstance) {
            sigmaInstance.kill();
            sigmaInstance = null;
        }
        destroy();
    });
</script>
