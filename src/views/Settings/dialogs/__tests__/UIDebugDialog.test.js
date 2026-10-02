import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key) => key })
}));

vi.mock('vue-router', () => ({
    useRouter: () => ({ push: vi.fn() })
}));

vi.mock('@/services/config', () => ({ default: {} }));
vi.mock('@/services/oobe', () => ({ resetOobe: vi.fn() }));
vi.mock('@/shared/constants/whatsNewReleases', () => ({
    getLatestWhatsNewRelease: vi.fn()
}));
vi.mock('@/stores/settings/appearance', () => ({
    useAppearanceSettingsStore: () => ({})
}));
vi.mock('@/stores/modal', () => ({ useModalStore: () => ({}) }));
vi.mock('@/stores/user', () => ({
    useUserStore: () => ({ currentUser: {} })
}));
vi.mock('@/stores/vrcxUpdater', () => ({
    useVRCXUpdaterStore: () => ({})
}));

const mocks = vi.hoisted(() => {
    const toast = vi.fn();
    toast.success = vi.fn();
    toast.error = vi.fn();
    toast.warning = vi.fn();
    return { toast };
});

vi.mock('vue-sonner', () => ({ toast: mocks.toast }));

vi.mock('@/views/Settings/dialogs/UIComponentGallery.vue', () => ({
    default: {
        name: 'UIComponentGallery',
        template: '<div><h3>Button</h3></div>'
    }
}));

import UIDebugDialog from '../UIDebugDialog.vue';

function nextFrame() {
    return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function')
            requestAnimationFrame(resolve);
        else setTimeout(resolve, 0);
    });
}

describe('UIDebugDialog', () => {
    test('resets dialog scroll when switching to the components tab', async () => {
        const wrapper = mount(UIDebugDialog, {
            props: { uidDialog: true },
            global: {
                stubs: {
                    Dialog: {
                        props: ['open'],
                        template: '<div v-if="open"><slot /></div>'
                    },
                    DialogContent: {
                        template:
                            '<div data-slot="dialog-content"><slot /></div>'
                    },
                    DialogHeader: { template: '<div><slot /></div>' },
                    DialogTitle: { template: '<h2><slot /></h2>' }
                }
            }
        });

        const scrollContainer = wrapper.get('[data-slot="dialog-content"]');
        scrollContainer.element.scrollTop = 640;

        const componentsTab = wrapper
            .findAll('button')
            .find((button) => button.text().includes('components'));
        expect(componentsTab).toBeTruthy();

        await componentsTab.trigger('mousedown');
        await nextTick();
        await nextFrame();

        expect(wrapper.text()).toContain('Button');
        expect(scrollContainer.element.scrollTop).toBe(0);
        wrapper.unmount();
    });
});
