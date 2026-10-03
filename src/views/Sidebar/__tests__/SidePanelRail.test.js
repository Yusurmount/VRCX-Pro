import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
    setSidePanelCollapsed: vi.fn(),
    openSearch: vi.fn(),
    groupInstances: { value: [] },
    hasUnseen: { value: true },
    centerOpen: { value: false },
    notificationLayout: { value: 'list' }
}));

vi.mock('pinia', async (i) => ({ ...(await i()), storeToRefs: (s) => s }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k) => k }) }));
vi.mock('../../../stores', () => ({
    useAppearanceSettingsStore: () => ({
        setSidePanelCollapsed: (...a) => mocks.setSidePanelCollapsed(...a)
    }),
    useGroupStore: () => ({ groupInstances: mocks.groupInstances }),
    useNotificationStore: () => ({
        isNotificationCenterOpen: mocks.centerOpen,
        hasUnseenNotifications: mocks.hasUnseen
    }),
    useNotificationsSettingsStore: () => ({
        notificationLayout: mocks.notificationLayout
    })
}));
vi.mock('../../../stores/quickSearch', () => ({
    useQuickSearchStore: () => ({ open: (...a) => mocks.openSearch(...a) })
}));
vi.mock('@/components/ui/button', () => ({
    Button: {
        props: ['ariaLabel'],
        emits: ['click'],
        template:
            '<button data-testid="btn" :aria-label="ariaLabel" @click="$emit(\'click\')"><slot /></button>'
    }
}));
vi.mock('@/components/ui/tooltip', () => ({
    TooltipWrapper: { template: '<div><slot /></div>' }
}));
vi.mock('lucide-vue-next', () => ({
    Bell: { template: '<i />' },
    PanelRightOpen: { template: '<i />' },
    Search: { template: '<i />' },
    UsersRound: { template: '<i />' }
}));

import SidePanelRail from '../SidePanelRail.vue';
import { activeSidePanelTab } from '../sidePanelUiState';

describe('SidePanelRail.vue', () => {
    beforeEach(() => {
        mocks.setSidePanelCollapsed.mockClear();
        mocks.openSearch.mockClear();
        mocks.groupInstances.value = [];
        mocks.centerOpen.value = false;
        mocks.notificationLayout.value = 'list';
        activeSidePanelTab.value = 'friends';
    });

    it('expands the side panel when the expand icon is clicked', async () => {
        activeSidePanelTab.value = 'tracked';
        const wrapper = mount(SidePanelRail);

        await wrapper
            .find('[aria-label="side_panel.expand_tooltip"]')
            .trigger('click');

        expect(mocks.setSidePanelCollapsed).toHaveBeenCalledWith(false);
        expect(activeSidePanelTab.value).toBe('tracked');
    });

    it('does not show the friends icon', () => {
        const wrapper = mount(SidePanelRail);
        expect(wrapper.find('[aria-label="side_panel.friends"]').exists()).toBe(
            false
        );
    });

    it('opens quick search without expanding when the search icon is clicked', async () => {
        const wrapper = mount(SidePanelRail);

        await wrapper
            .find('[aria-label="side_panel.search_placeholder"]')
            .trigger('click');

        expect(mocks.openSearch).toHaveBeenCalled();
        expect(mocks.setSidePanelCollapsed).not.toHaveBeenCalled();
    });

    it('opens the notification center without expanding when the bell icon is clicked', async () => {
        const wrapper = mount(SidePanelRail);

        await wrapper
            .find('[aria-label="side_panel.notification_center.title"]')
            .trigger('click');

        expect(mocks.centerOpen.value).toBe(true);
        expect(mocks.setSidePanelCollapsed).not.toHaveBeenCalled();
    });

    it('does not show the tracked non-friends icon', () => {
        const wrapper = mount(SidePanelRail);
        expect(
            wrapper
                .find('[aria-label="side_panel.tracked_nonfriends.tab_label"]')
                .exists()
        ).toBe(false);
    });

    it('shows the groups icon only when group instances exist', () => {
        const withoutGroups = mount(SidePanelRail);
        expect(
            withoutGroups.find('[aria-label="side_panel.groups"]').exists()
        ).toBe(false);

        mocks.groupInstances.value = [{}];
        const withGroups = mount(SidePanelRail);
        expect(
            withGroups.find('[aria-label="side_panel.groups"]').exists()
        ).toBe(true);
    });
});
