import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key, params) =>
            params
                ? `${key} ${Object.entries(params)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(' ')}`
                : key
    })
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
import { executeImport, readImportFile } from '@/services/database/exportImport';

/**
 * Click the first button whose (i18n-mocked) text contains `fragment`.
 * @param {import('@vue/test-utils').VueWrapper} wrapper
 * @param {string} fragment
 */
async function clickButtonByText(wrapper, fragment) {
    const button = wrapper.findAll('button').find((b) => b.text().includes(fragment));
    expect(button, `button containing "${fragment}"`).toBeTruthy();
    await button.trigger('click');
    await flushPromises();
}

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

    test('progress step drives bar and percentage from one integer and shows the current table', async () => {
        readImportFile.mockResolvedValue({
            success: true,
            data: { metadata: { version: 1 }, tables: { feed_post: [] } },
            summary: { tableCount: 1, totalRecords: 0, recordsPerTable: { feed_post: 0 } }
        });
        executeImport.mockImplementation((data, strategies, onProgress) => {
            onProgress({
                phase: 'importing',
                percent: 42,
                table: 'feed_post',
                tableIndex: 1,
                tableCount: 3,
                tableRowsDone: 5,
                tableRowsTotal: 10,
                processedRows: 5,
                totalRows: 30
            });
            // Keep step 4 open so the progress UI can be inspected.
            return new Promise(() => {});
        });

        const wrapper = mount(DatabaseRestoreWizard, { props: { visible: true } });
        await flushPromises();
        await clickButtonByText(wrapper, 'wizard_next'); // step 1 -> 2
        await clickButtonByText(wrapper, 'wizard_next'); // step 2 -> 3
        await clickButtonByText(wrapper, 'select_file');
        await clickButtonByText(wrapper, 'db_import.button'); // start import -> step 4

        const fill = wrapper.find('.bg-primary.h-2');
        expect(fill.exists()).toBe(true);
        expect(fill.attributes('style')).toContain('width: 42%');

        const text = wrapper.text();
        expect(text).toContain('db_import.importing progress=42');
        expect(text).toContain('db_import.progress_detail_importing');
        expect(text).toContain('table=feed_post');
        expect(text).toContain('tableRowsDone=5');
        expect(text).toContain('processedRows=5');
    });

    test('debug progress preview opens straight to the progress step', async () => {
        const wrapper = mount(DatabaseRestoreWizard, {
            props: { visible: false, debugProgressPreview: true }
        });
        await wrapper.setProps({ visible: true });
        await flushPromises();

        expect(wrapper.text()).toContain('db_import.progress_title');
        const cancel = wrapper
            .findAll('button')
            .find((b) => b.text().includes('confirm.cancel_button'));
        expect(cancel).toBeTruthy();

        wrapper.unmount();
    });
});
