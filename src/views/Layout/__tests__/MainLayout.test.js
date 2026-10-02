import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

const mocks = vi.hoisted(() => ({
    replace: vi.fn(),
    setNavCollapsed: vi.fn(),
    setNavWidth: vi.fn(),
    setSidePanelCollapsed: vi.fn(),
    isLoggedIn: false,
    sidePanelCollapsed: { value: false },
    sideBarTabShow: { value: true }
}));

vi.mock('pinia', async (i) => ({ ...(await i()), storeToRefs: (s) => s }));
vi.mock('vue-router', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useRouter: () => ({ replace: (...a) => mocks.replace(...a) })
    };
});
vi.mock('../../../services/watchState', () => ({
    watchState: {
        get isLoggedIn() {
            return mocks.isLoggedIn;
        }
    }
}));
vi.mock('../../../stores', () => ({
    useAppearanceSettingsStore: () => ({
        navWidth: ref(240),
        isNavCollapsed: ref(false),
        isSidePanelCollapsed: mocks.sidePanelCollapsed,
        setNavCollapsed: (...a) => mocks.setNavCollapsed(...a),
        setNavWidth: (...a) => mocks.setNavWidth(...a),
        setSidePanelCollapsed: (...a) => mocks.setSidePanelCollapsed(...a)
    })
}));
vi.mock('../../../composables/useMainLayoutResizable', () => ({
    useMainLayoutResizable: () => ({
        asideDefaultSize: 30,
        asideMinSize: 0,
        asideMaxPx: 480,
        mainDefaultSize: 70,
        handleLayout: vi.fn(),
        isAsideCollapsed: () => false,
        isAsideCollapsedStatic: false,
        isSideBarTabShow: mocks.sideBarTabShow
    })
}));
vi.mock('../../../components/ui/resizable', () => ({
    ResizablePanelGroup: { template: '<div><slot :layout="[]" /></div>' },
    ResizablePanel: {
        template: '<div><slot /></div>',
        methods: {
            collapse: vi.fn(),
            expand: vi.fn()
        }
    },
    ResizableHandle: { template: '<div />' }
}));
vi.mock('../../../components/ui/sidebar', () => ({
    SidebarProvider: { template: '<div><slot /></div>' },
    SidebarInset: { template: '<div><slot /></div>' }
}));
vi.mock('../../../components/nav-menu/NavMenu.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../Sidebar/Sidebar.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../Sidebar/SidePanelRail.vue', () => ({
    __esModule: true,
    default: { template: '<div data-testid="side-panel-rail" />' }
}));
vi.mock('../../../components/StatusBar.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../../components/dialogs/MainDialogContainer.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../../components/FullscreenImagePreview.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../../components/dialogs/ChooseFavoriteGroupDialog.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../../components/dialogs/LaunchDialog.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../Settings/dialogs/LaunchOptionsDialog.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../Favorites/dialogs/FriendImportDialog.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../Favorites/dialogs/WorldImportDialog.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../Favorites/dialogs/AvatarImportDialog.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock(
    '../../../components/dialogs/GroupDialog/GroupMemberModerationDialog.vue',
    () => ({ __esModule: true, default: { template: '<div />' } })
);
vi.mock('../../../components/dialogs/InviteGroupDialog.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../Settings/dialogs/VRChatConfigDialog.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../Settings/dialogs/PrimaryPasswordDialog.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../../components/dialogs/SendBoopDialog.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../Settings/dialogs/ChangelogDialog.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../../components/dialogs/AutoFollowDialog.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../../components/dialogs/GroupDialog/GroupEditDialog.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock(
    '../../../components/dialogs/GroupDialog/GroupEventEditDialog.vue',
    () => ({
        __esModule: true,
        default: { template: '<div />' }
    })
);
vi.mock('../../Tools/components/GlobalToolsDialogs.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../../components/onboarding/WhatsNewDialog.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));
vi.mock('../../../components/onboarding/SpotlightDialog.vue', () => ({
    __esModule: true,
    default: { template: '<div />' }
}));

import MainLayout from '../MainLayout.vue';

describe('MainLayout.vue', () => {
    const mountLayout = () =>
        mount(MainLayout, {
            global: {
                stubs: {
                    RouterView: { template: '<div />' },
                    KeepAlive: { template: '<div><slot /></div>' }
                }
            }
        });

    beforeEach(() => {
        mocks.isLoggedIn = false;
        mocks.sidePanelCollapsed.value = false;
        mocks.sideBarTabShow.value = true;
    });

    it('redirects to login when not logged in', () => {
        mountLayout();
        expect(mocks.replace).toHaveBeenCalledWith({ name: 'login' });
    });

    it('shows the side panel rail when the side panel is collapsed', () => {
        mocks.isLoggedIn = true;
        mocks.sidePanelCollapsed.value = true;
        const wrapper = mountLayout();
        expect(wrapper.find('[data-testid="side-panel-rail"]').exists()).toBe(
            true
        );
    });

    it('hides the side panel rail when the side panel is expanded', () => {
        mocks.isLoggedIn = true;
        const wrapper = mountLayout();
        expect(wrapper.find('[data-testid="side-panel-rail"]').exists()).toBe(
            false
        );
    });

    it('hides the side panel rail when the route hides the side panel', () => {
        mocks.isLoggedIn = true;
        mocks.sidePanelCollapsed.value = true;
        mocks.sideBarTabShow.value = false;
        const wrapper = mountLayout();
        expect(wrapper.find('[data-testid="side-panel-rail"]').exists()).toBe(
            false
        );
    });
});
