import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => {
    const { ref } = require('vue');

    return {
        state: {
            appVersion: ref('VRCX-Pro 3.3.0'),
            acceptBeta: ref(false),
            autoUpdateVRCX: ref('Notify'),
            checkingForVRCXUpdate: ref(false),
            VRCXUpdateDialog: ref({
                visible: true,
                updatePending: false,
                release: 'VRCX-Pro 3.3.0',
                releases: []
            }),
            changeLogDialog: ref({
                visible: false,
                buildName: 'VRCX-Pro 3.4.0',
                changeLog: '## Improvements\n- Inline release notes',
                loading: false,
                loaded: true
            }),
            pendingVRCXInstall: ref(''),
            downloadRoute: ref('official'),
            updateInProgress: ref(false),
            updateProgress: ref(0),
            updateError: ref('')
        },
        actions: {
            downloadSelectedVRCXUpdate: vi.fn(),
            restartVRCX: vi.fn(),
            updateProgressText: vi.fn(() => '42%'),
            cancelUpdate: vi.fn(),
            setAcceptBeta: vi.fn(),
            setAutoUpdateVRCX: vi.fn(),
            setUpdateRoute: vi.fn(),
            openExternalLink: vi.fn()
        }
    };
});

vi.mock('pinia', () => ({
    storeToRefs: () => mocks.state
}));

vi.mock('@/stores', () => ({
    useVRCXUpdaterStore: () => ({
        ...mocks.state,
        ...mocks.actions
    })
}));

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key) => key
    })
}));

vi.mock('@/shared/utils', () => ({
    openExternalLink: mocks.actions.openExternalLink
}));

vi.mock('vue-showdown', () => ({
    VueShowdown: {
        props: ['markdown', 'flavor', 'options'],
        template: '<div data-testid="inline-markdown">{{ markdown }}</div>'
    }
}));

import VRCXUpdateDialog from '../VRCXUpdateDialog.vue';

const slotStub = {
    template: '<div><slot /></div>'
};

function mountComponent() {
    return mount(VRCXUpdateDialog, {
        global: {
            stubs: {
                Dialog: {
                    props: ['open'],
                    template: '<div v-if="open"><slot /></div>'
                },
                DialogContent: slotStub,
                DialogHeader: slotStub,
                DialogTitle: slotStub,
                DialogFooter: slotStub,
                Button: {
                    props: ['variant', 'disabled'],
                    inheritAttrs: false,
                    emits: ['click'],
                    template:
                        '<button :data-testid="$attrs[\'data-testid\'] || \'action-button\'" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'
                },
                Progress: {
                    props: ['modelValue'],
                    template:
                        '<div data-testid="progress" :data-value="modelValue" />'
                },
                DropdownMenu: slotStub,
                DropdownMenuTrigger: {
                    props: ['asChild'],
                    template:
                        '<div data-slot="dropdown-menu-trigger"><slot /></div>'
                },
                DropdownMenuContent: {
                    inheritAttrs: false,
                    template:
                        "<div :data-testid=\"$attrs['data-testid'] || 'dropdown-content'\"><slot /></div>"
                },
                DropdownMenuItem: {
                    props: ['variant', 'disabled'],
                    inheritAttrs: false,
                    emits: ['click'],
                    template:
                        "<button :data-testid=\"$attrs['data-testid'] || 'action-button'\" @click=\"$emit('click')\"><slot /></button>"
                },
                DropdownMenuCheckboxItem: {
                    props: ['modelValue', 'disabled'],
                    inheritAttrs: false,
                    emits: ['select'],
                    template:
                        "<div :data-testid=\"$attrs['data-testid'] || 'check-item'\" @click=\"$emit('select')\"><slot /></div>"
                },
                DropdownMenuSeparator: { template: '<div />' }
            }
        }
    });
}

describe('VRCXUpdateDialog.vue', () => {
    beforeEach(() => {
        mocks.state.appVersion.value = 'VRCX-Pro 3.3.0';
        mocks.state.acceptBeta.value = false;
        mocks.state.autoUpdateVRCX.value = 'Notify';
        mocks.state.checkingForVRCXUpdate.value = false;
        mocks.state.VRCXUpdateDialog.value = {
            visible: true,
            updatePending: false,
            release: 'VRCX-Pro 3.3.0',
            releases: []
        };
        mocks.state.changeLogDialog.value = {
            visible: false,
            buildName: 'VRCX-Pro 3.4.0',
            changeLog: '## Improvements\n- Inline release notes',
            loading: false,
            loaded: true
        };
        mocks.state.pendingVRCXInstall.value = '';
        mocks.state.downloadRoute.value = 'official';
        mocks.state.updateInProgress.value = false;
        mocks.state.updateProgress.value = 0;
        mocks.state.updateError.value = '';
        vi.clearAllMocks();
    });

    test('shows the up-to-date state with a change-version menu action', async () => {
        mocks.state.VRCXUpdateDialog.value.release = 'v3.3.0';
        const wrapper = mountComponent();
        const changeVersionButton = wrapper.find(
            '[data-testid="change-version-item"]'
        );

        expect(wrapper.text()).toContain('dialog.vrcx_updater.latest_version');
        expect(wrapper.text()).toContain('dialog.vrcx_updater.current_version');
        expect(changeVersionButton.exists()).toBe(true);

        await changeVersionButton.trigger('click');
        expect(mocks.actions.openExternalLink).toHaveBeenCalledWith(
            'https://github.com/Yusurmount/VRCX-Pro/releases'
        );
    });

    test('offers beta opt-in and update notify toggles in the header menu', async () => {
        const wrapper = mountComponent();
        const betaItem = wrapper.find('[data-testid="accept-beta-item"]');
        const notifyItem = wrapper.find('[data-testid="notify-update-item"]');

        expect(betaItem.exists()).toBe(true);
        expect(notifyItem.exists()).toBe(true);
        expect(betaItem.text()).toContain('dialog.vrcx_updater.accept_beta');
        expect(notifyItem.text()).toContain(
            'dialog.vrcx_updater.notify_update'
        );

        await betaItem.trigger('click');
        expect(mocks.actions.setAcceptBeta).toHaveBeenCalledWith(true);

        await notifyItem.trigger('click');
        expect(mocks.actions.setAutoUpdateVRCX).toHaveBeenCalledWith('Off');
    });

    test('renders GitHub release notes inline without opening another dialog', async () => {
        const wrapper = mountComponent();
        await new Promise((resolve) => setTimeout(resolve, 0));
        const changeLog = wrapper.find('[data-testid="inline-change-log"]');

        expect(wrapper.text()).not.toContain(
            'dialog.vrcx_updater.branch_stable'
        );
        expect(wrapper.text()).not.toContain(
            'dialog.vrcx_updater.branch_nightly'
        );
        expect(wrapper.text()).not.toContain(
            'dialog.vrcx_updater.update_channel'
        );
        expect(changeLog.exists()).toBe(true);
        expect(changeLog.text()).toContain('dialog.change_log.header');
        expect(changeLog.text()).toContain('VRCX-Pro 3.4.0');
        expect(changeLog.text()).toContain('Inline release notes');
        expect(wrapper.find('[data-testid="change-log-card"]').exists()).toBe(
            false
        );
        expect(mocks.state.VRCXUpdateDialog.value.visible).toBe(true);
    });

    test('hides release notes and warns when the current version is higher', async () => {
        mocks.state.appVersion.value = 'VRCX-Pro 3.4.0';
        mocks.state.VRCXUpdateDialog.value.release = 'v3.3.0';
        mocks.state.VRCXUpdateDialog.value.updatePending = true;
        mocks.state.pendingVRCXInstall.value = 'VRCX-Pro 3.3.0';
        const wrapper = mountComponent();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(wrapper.text()).toContain(
            'dialog.vrcx_updater.unpublished_version'
        );
        expect(wrapper.find('[data-testid="inline-change-log"]').exists()).toBe(
            false
        );
        expect(wrapper.text()).not.toContain(
            'dialog.vrcx_updater.update_available'
        );
        expect(
            wrapper
                .findAll('[data-testid="action-button"]')
                .some((button) =>
                    button.text().includes('dialog.vrcx_updater.download')
                )
        ).toBe(false);
        expect(
            wrapper
                .findAll('[data-testid="action-button"]')
                .some((button) =>
                    button.text().includes('dialog.vrcx_updater.install')
                )
        ).toBe(false);
    });

    test('shows a download action when a newer release is selected', async () => {
        mocks.state.VRCXUpdateDialog.value.release = 'VRCX-Pro 3.4.0';
        const wrapper = mountComponent();
        const downloadButton = wrapper
            .findAll('[data-testid="action-button"]')
            .find((button) =>
                button.text().includes('dialog.vrcx_updater.download')
            );

        expect(wrapper.text()).toContain(
            'dialog.vrcx_updater.update_available'
        );
        expect(downloadButton).toBeTruthy();

        await downloadButton.trigger('click');
        expect(mocks.actions.downloadSelectedVRCXUpdate).toHaveBeenCalledOnce();
        expect(wrapper.find('[data-testid="route-trigger"]').exists()).toBe(
            true
        );
        const routeOptions = wrapper.find('[data-testid="route-options"]');
        expect(routeOptions.text()).toContain(
            'dialog.vrcx_updater.route_official'
        );
        expect(routeOptions.text()).toContain(
            'dialog.vrcx_updater.route_mirror'
        );

        await routeOptions
            .findAll('[data-testid="check-item"]')[1]
            .trigger('click');
        expect(mocks.actions.setUpdateRoute).toHaveBeenCalledWith('mirror');
    });

    test('shows the ready state with an install action', async () => {
        mocks.state.VRCXUpdateDialog.value.updatePending = true;
        mocks.state.VRCXUpdateDialog.value.release = 'VRCX-Pro 3.4.0';
        mocks.state.pendingVRCXInstall.value = 'VRCX-Pro 3.4.0';
        const wrapper = mountComponent();
        const installButton = wrapper
            .findAll('[data-testid="action-button"]')
            .find((button) =>
                button.text().includes('dialog.vrcx_updater.install')
            );

        expect(wrapper.text()).toContain('VRCX-Pro 3.4.0');
        expect(wrapper.text()).toContain(
            'dialog.vrcx_updater.ready_for_update'
        );
        expect(installButton).toBeTruthy();

        await installButton.trigger('click');
        expect(mocks.actions.restartVRCX).toHaveBeenCalledWith(true);
    });

    test('shows progress and only the cancel action while downloading', async () => {
        mocks.state.updateInProgress.value = true;
        mocks.state.updateProgress.value = 42;
        const wrapper = mountComponent();
        const buttons = wrapper.findAll('[data-testid="action-button"]');

        expect(wrapper.text()).toContain('dialog.vrcx_updater.downloading');
        expect(wrapper.text()).toContain('42%');
        expect(wrapper.find('[data-testid="progress"]').exists()).toBe(true);
        expect(buttons).toHaveLength(1);
        expect(buttons[0].text()).toContain('dialog.vrcx_updater.cancel');

        await buttons[0].trigger('click');
        expect(mocks.actions.cancelUpdate).toHaveBeenCalledOnce();
    });

    test('shows the download error inline with a retry action', async () => {
        mocks.state.updateError.value =
            'message.vrcx_updater.download_failed: Network error';
        mocks.state.VRCXUpdateDialog.value.release = 'VRCX-Pro 3.4.0';
        const wrapper = mountComponent();
        const buttons = wrapper.findAll('[data-testid="action-button"]');

        expect(wrapper.find('[data-testid="update-error"]').exists()).toBe(
            true
        );
        expect(wrapper.text()).toContain('dialog.vrcx_updater.error_title');
        expect(wrapper.text()).toContain('Network error');
        expect(
            buttons.some((button) =>
                button.text().includes('dialog.vrcx_updater.download')
            )
        ).toBe(true);
        expect(
            buttons.some((button) =>
                button.text().includes('dialog.vrcx_updater.install')
            )
        ).toBe(false);
    });
});
