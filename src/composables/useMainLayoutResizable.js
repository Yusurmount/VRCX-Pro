import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';

import { useAppearanceSettingsStore } from '../stores';

export function useMainLayoutResizable() {
    const appearanceStore = useAppearanceSettingsStore();
    const { isSideBarTabShow, isSidePanelCollapsed } =
        storeToRefs(appearanceStore);

    const asideDefaultSize = 25;
    const mainDefaultSize = 75;
    const asideMinSize = 12;
    const asideMaxPx = 700;

    const isAsideCollapsed = (layout) =>
        Array.isArray(layout) &&
        layout.length >= 2 &&
        layout[layout.length - 1] <= 1;

    const isAsideCollapsedState = ref(false);
    const handleLayout = (sizes) => {
        if (!Array.isArray(sizes) || sizes.length < 2) {
            isAsideCollapsedState.value = false;
            return;
        }
        isAsideCollapsedState.value = isAsideCollapsed(sizes);
        // 拖拽越过吸附阈值会直接缩到 0（表现为整块隐藏），同步为图标栏收起态；
        // 路由隐藏侧栏的场景不落库，避免污染用户手动设置的收起状态
        if (
            isAsideCollapsedState.value &&
            isSideBarTabShow.value &&
            !isSidePanelCollapsed.value
        ) {
            appearanceStore.setSidePanelCollapsed(true);
        }
    };

    const isAsideCollapsedStatic = computed(
        () => !isSideBarTabShow.value || isAsideCollapsedState.value
    );

    return {
        asideDefaultSize,
        asideMinSize,
        asideMaxPx,
        mainDefaultSize,
        handleLayout,
        isAsideCollapsed,
        isAsideCollapsedStatic,
        isSideBarTabShow
    };
}
