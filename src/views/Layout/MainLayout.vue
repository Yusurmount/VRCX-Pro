<template>
    <template v-if="watchState.isLoggedIn">
        <div class="flex flex-col flex-1 h-full min-h-0 min-w-0 overflow-hidden">
            <SidebarProvider
                :open="sidebarOpen"
                :width="navWidth"
                :width-icon="48"
                class="relative flex-1 h-full min-w-0 min-h-0"
                @update:open="handleSidebarOpenChange">
                <NavMenu />

                <div
                    v-show="sidebarOpen"
                    class="absolute top-0 bottom-0 z-30 w-1 cursor-ew-resize select-none"
                    :style="{ left: 'var(--sidebar-width)' }"
                    @pointerdown.prevent="startNavResize" />

                <SidebarInset class="min-w-0 bg-sidebar">
                    <ResizablePanelGroup
                        direction="horizontal"
                        auto-save-id="vrcx-main-layout-right-sidebar"
                        :class="[
                            'group/main-layout flex-1 h-full min-w-0',
                            { 'aside-collapsed': isAsideCollapsedStatic }
                        ]"
                        @layout="handleLayout">
                        <template #default="{ layout }">
                            <ResizablePanel :default-size="mainDefaultSize" :order="1">
                                <RouterView v-slot="{ Component }">
                                    <!-- 图表页含 echarts/ResizeObserver/Worker，不适合 KeepAlive 常驻缓存，全部排除 -->
                                    <KeepAlive
                                        exclude="ChartsInstance, ChartsMutual, ChartsRelationshipTimeline, ChartsHotWorlds, ChartsTwoPersonRelationship">
                                        <component :is="Component" />
                                    </KeepAlive>
                                </RouterView>
                            </ResizablePanel>

                            <ResizableHandle
                                with-handle
                                :class="[
                                    isAsideCollapsed(layout) ? 'opacity-100' : 'opacity-0',
                                    'z-20 [&>div]:-translate-x-1/2'
                                ]"></ResizableHandle>
                            <ResizablePanel
                                ref="asidePanelRef"
                                :default-size="asideDefaultSize"
                                :min-size="asideMinSize"
                                :collapsed-size="0"
                                collapsible
                                :order="2"
                                :style="{ maxWidth: `${asideMaxPx}px` }">
                                <Sidebar></Sidebar>
                            </ResizablePanel>
                        </template>
                    </ResizablePanelGroup>
                </SidebarInset>
            </SidebarProvider>
            <StatusBar />
        </div>

        <!-- ## Dialogs ## -->
        <MainDialogContainer></MainDialogContainer>

        <InviteGroupDialog></InviteGroupDialog>

        <FullscreenImagePreview></FullscreenImagePreview>

        <LaunchDialog></LaunchDialog>

        <LaunchOptionsDialog></LaunchOptionsDialog>

        <FriendImportDialog></FriendImportDialog>

        <WorldImportDialog></WorldImportDialog>

        <AvatarImportDialog></AvatarImportDialog>

        <ChooseFavoriteGroupDialog></ChooseFavoriteGroupDialog>

        <VRChatConfigDialog></VRChatConfigDialog>

        <PrimaryPasswordDialog></PrimaryPasswordDialog>

        <SendBoopDialog></SendBoopDialog>

        <AutoFollowDialog v-model:open="isAutoFollowDialogOpen"></AutoFollowDialog>

        <GlobalToolsDialogs></GlobalToolsDialogs>

        <ChangelogDialog></ChangelogDialog>

        <WhatsNewDialog></WhatsNewDialog>

        <SpotlightDialog></SpotlightDialog>
    </template>
</template>

<script setup>
    import { computed, defineAsyncComponent, nextTick, onUnmounted, ref, watch } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useRouter } from 'vue-router';

    import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../components/ui/resizable';
    import { SidebarInset, SidebarProvider } from '../../components/ui/sidebar';
    import { useAppearanceSettingsStore } from '../../stores';
    import { useMainLayoutResizable } from '../../composables/useMainLayoutResizable';
    import { watchState } from '../../services/watchState';

    const AvatarImportDialog = defineAsyncComponent(() => import('../Favorites/dialogs/AvatarImportDialog.vue'));
    const ChangelogDialog = defineAsyncComponent(() => import('../Settings/dialogs/ChangelogDialog.vue'));
    import AutoFollowDialog from '../../components/dialogs/AutoFollowDialog.vue';
    const ChooseFavoriteGroupDialog = defineAsyncComponent(() => import('../../components/dialogs/ChooseFavoriteGroupDialog.vue'));
    const FriendImportDialog = defineAsyncComponent(() => import('../Favorites/dialogs/FriendImportDialog.vue'));
    const FullscreenImagePreview = defineAsyncComponent(() => import('../../components/FullscreenImagePreview.vue'));
    const GlobalToolsDialogs = defineAsyncComponent(() => import('../Tools/components/GlobalToolsDialogs.vue'));
    const InviteGroupDialog = defineAsyncComponent(() => import('../../components/dialogs/InviteGroupDialog.vue'));
    const LaunchDialog = defineAsyncComponent(() => import('../../components/dialogs/LaunchDialog.vue'));
    const LaunchOptionsDialog = defineAsyncComponent(() => import('../Settings/dialogs/LaunchOptionsDialog.vue'));
    import MainDialogContainer from '../../components/dialogs/MainDialogContainer.vue';
    import NavMenu from '../../components/nav-menu/NavMenu.vue';
    const PrimaryPasswordDialog = defineAsyncComponent(() => import('../Settings/dialogs/PrimaryPasswordDialog.vue'));
    const SendBoopDialog = defineAsyncComponent(() => import('../../components/dialogs/SendBoopDialog.vue'));
    import Sidebar from '../Sidebar/Sidebar.vue';
    import StatusBar from '../../components/StatusBar.vue';
    const VRChatConfigDialog = defineAsyncComponent(() => import('../Settings/dialogs/VRChatConfigDialog.vue'));
    const WorldImportDialog = defineAsyncComponent(() => import('../Favorites/dialogs/WorldImportDialog.vue'));
    const WhatsNewDialog = defineAsyncComponent(() => import('../../components/onboarding/WhatsNewDialog.vue'));
    const SpotlightDialog = defineAsyncComponent(() => import('../../components/onboarding/SpotlightDialog.vue'));

    import { isAutoFollowDialogOpen } from '../../coordinators/autoFollowCoordinator';

    const router = useRouter();

    const appearanceSettingsStore = useAppearanceSettingsStore();
    const { navWidth, isNavCollapsed } = storeToRefs(appearanceSettingsStore);

    const sidebarOpen = computed(() => !isNavCollapsed.value);

    const handleSidebarOpenChange = (open) => {
        appearanceSettingsStore.setNavCollapsed(!open);
    };

    let isResizingNav = false;
    let cleanupNavResize = null;

    const startNavResize = (event) => {
        if (!sidebarOpen.value) {
            return;
        }

        isResizingNav = true;
        const prevUserSelect = document.body.style.userSelect;
        const prevCursor = document.body.style.cursor;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        const handleMove = (e) => {
            if (!isResizingNav) {
                return;
            }
            appearanceSettingsStore.setNavWidth(e.clientX);
        };

        const handleUp = () => {
            isResizingNav = false;
            document.body.style.userSelect = prevUserSelect;
            document.body.style.cursor = prevCursor;
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            cleanupNavResize = null;
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        cleanupNavResize = handleUp;
        appearanceSettingsStore.setNavWidth(event.clientX);
    };

    onUnmounted(() => {
        cleanupNavResize?.();
    });

    const {
        asideDefaultSize,
        asideMinSize,
        asideMaxPx,
        mainDefaultSize,
        handleLayout,
        isAsideCollapsed,
        isAsideCollapsedStatic,
        isSideBarTabShow
    } = useMainLayoutResizable();

    const asidePanelRef = ref(null);

    watch(isSideBarTabShow, async (show) => {
        await nextTick();
        if (show) {
            asidePanelRef.value?.expand();
        } else {
            asidePanelRef.value?.collapse();
        }
    });

    watch(
        () => watchState.isLoggedIn,
        (isLoggedIn) => {
            if (!isLoggedIn) {
                router.replace({ name: 'login' });
            }
        },
        { immediate: true }
    );
</script>
