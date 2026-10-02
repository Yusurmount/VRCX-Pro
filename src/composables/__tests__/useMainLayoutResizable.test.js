import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

const mocks = vi.hoisted(() => ({
    setSidePanelCollapsed: vi.fn(),
    isSidePanelCollapsed: null,
    isSideBarTabShow: null
}));

vi.mock('pinia', async (i) => ({ ...(await i()), storeToRefs: (s) => s }));
vi.mock('../../stores', () => ({
    useAppearanceSettingsStore: () => ({
        isSidePanelCollapsed: mocks.isSidePanelCollapsed,
        isSideBarTabShow: mocks.isSideBarTabShow,
        setSidePanelCollapsed: (...a) => mocks.setSidePanelCollapsed(...a)
    })
}));

import { useMainLayoutResizable } from '../useMainLayoutResizable';

describe('useMainLayoutResizable', () => {
    beforeEach(() => {
        mocks.setSidePanelCollapsed.mockClear();
        mocks.isSidePanelCollapsed = ref(false);
        mocks.isSideBarTabShow = ref(true);
    });

    it('syncs drag collapse to the icon-rail collapsed state', () => {
        const { handleLayout } = useMainLayoutResizable();

        handleLayout([75, 0]);

        expect(mocks.setSidePanelCollapsed).toHaveBeenCalledWith(true);
    });

    it('does not sync when the route hides the side panel', () => {
        mocks.isSideBarTabShow.value = false;
        const { handleLayout } = useMainLayoutResizable();

        handleLayout([75, 0]);

        expect(mocks.setSidePanelCollapsed).not.toHaveBeenCalled();
    });

    it('does not sync when the panel is not collapsed', () => {
        const { handleLayout } = useMainLayoutResizable();

        handleLayout([75, 30]);

        expect(mocks.setSidePanelCollapsed).not.toHaveBeenCalled();
    });

    it('does not write again when already collapsed', () => {
        mocks.isSidePanelCollapsed.value = true;
        const { handleLayout } = useMainLayoutResizable();

        handleLayout([75, 0]);

        expect(mocks.setSidePanelCollapsed).not.toHaveBeenCalled();
    });
});
