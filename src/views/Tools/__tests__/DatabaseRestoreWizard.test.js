import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key) => key })
}));

vi.mock('vue-sonner', () => {
    const toast = vi.fn();
    toast.success = vi.fn();
    toast.error = vi.fn();
    return { toast };
});

vi.mock('@/stores', () => ({
    useFeedStore: () => ({ feedTableLookup: vi.fn() }),
    useUserStore: () => ({ currentUser: { id: 'usr_1' } }),
    useVRCXUpdaterStore: () => ({ restartVRCX: vi.fn() })
}));

vi.mock('@/services/database/exportImport', () => ({
    readImportFile: vi.fn(),
    executeImport: vi.fn()
}));

vi.mock('@/coordinators/favoriteCoordinator', () => ({
    getLocalWorldFavorites: vi.fn(),
    getLocalAvatarFavorites: vi.fn(),
    getLocalFriendFavorites: vi.fn()
}));

import DatabaseRestoreWizard from '../DatabaseRestoreWizard.vue';

describe('DatabaseRestoreWizard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('visible wizard renders a fixed overlay wrapping the shell', async () => {
        const wrapper = mount(DatabaseRestoreWizard, {
            props: { visible: true }
        });
        await flushPromises();

        const overlay = wrapper.find('.restore-wizard-overlay');
        expect(overlay.exists()).toBe(true);
        expect(overlay.text()).toContain(
            'view.settings.advanced.advanced.db_import.wizard_mode_title'
        );
        expect(wrapper.find('.wizard-shell').exists()).toBe(true);
        expect(wrapper.html()).toContain('1 / 5');
    });

    test('hidden wizard renders nothing', async () => {
        const wrapper = mount(DatabaseRestoreWizard, {
            props: { visible: false }
        });
        await flushPromises();

        expect(wrapper.find('.restore-wizard-overlay').exists()).toBe(false);
        expect(wrapper.find('.wizard-shell').exists()).toBe(false);
    });
});
