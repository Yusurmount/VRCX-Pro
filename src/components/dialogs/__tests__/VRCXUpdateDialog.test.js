import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => {
    const { ref } = require('vue');

    return {
        state: {
            appVersion: ref('VRCX-Pro 3.3.0'),
            checkingForVRCXUpdate: ref(false),
            VRCXUpdateDialog: ref({
                visible: true,
                updatePending: false,
                release: 'VRCX-Pro 3.3.0',
                releases: []
            }),
            pendingVRCXInstall: ref(''),
            updateInProgress: ref(false),
            updateProgress: ref(0)
        },
        actions: {
            installVRCXUpdate: vi.fn(),
            restartVRCX: vi.fn(),
            showChangeLogDialog: vi.fn(),
            updateProgressText: vi.fn(() => '42%'),
            cancelUpdate: vi.fn(),
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
                    emits: ['click'],
                    template:
                        '<button data-testid="action-button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'
                },
                Progress: {
                    props: ['modelValue'],
                    template:
                        '<div data-testid="progress" :data-value="modelValue" />'
                }
            }
        }
    });
}

describe('VRCXUpdateDialog.vue', () => {
    beforeEach(() => {
        mocks.state.appVersion.value = 'VRCX-Pro 3.3.0';
        mocks.state.checkingForVRCXUpdate.value = false;
        mocks.state.VRCXUpdateDialog.value = {
            visible: true,
            updatePending: false,
            release: 'VRCX-Pro 3.3.0',
            releases: []
        };
        mocks.state.pendingVRCXInstall.value = '';
        mocks.state.updateInProgress.value = false;
        mocks.state.updateProgress.value = 0;
        vi.clearAllMocks();
    });

    test('shows the up-to-date state with a change-version action', async () => {
        mocks.state.VRCXUpdateDialog.value.release = 'v3.3.0';
        const wrapper = mountComponent();
        const changeVersionButton = wrapper
            .findAll('[data-testid="action-button"]')
            .find((button) =>
                button.text().includes('dialog.vrcx_updater.change_version')
            );

        expect(wrapper.text()).toContain('dialog.vrcx_updater.latest_version');
        expect(wrapper.text()).toContain('dialog.vrcx_updater.current_version');
        expect(changeVersionButton).toBeTruthy();

        await changeVersionButton.trigger('click');
        expect(mocks.actions.openExternalLink).toHaveBeenCalledWith(
            'https://github.com/Yusurmount/VRCX-Pro/releases'
        );
    });

    test('replaces version selection with a change-log entry point', async () => {
        const wrapper = mountComponent();
        const changeLogCard = wrapper.find('[data-testid="change-log-card"]');

        expect(wrapper.text()).not.toContain(
            'dialog.vrcx_updater.branch_stable'
        );
        expect(wrapper.text()).not.toContain(
            'dialog.vrcx_updater.branch_nightly'
        );
        expect(wrapper.text()).not.toContain(
            'dialog.vrcx_updater.update_channel'
        );
        expect(changeLogCard.exists()).toBe(true);

        await changeLogCard.trigger('click');
        expect(mocks.actions.showChangeLogDialog).toHaveBeenCalledOnce();
        expect(mocks.state.VRCXUpdateDialog.value.visible).toBe(false);
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
        expect(mocks.actions.installVRCXUpdate).toHaveBeenCalledOnce();
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
});
