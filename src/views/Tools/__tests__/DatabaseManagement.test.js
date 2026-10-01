import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const { push, vacuum, optimize, execute } = vi.hoisted(() => {
    const push = vi.fn();
    const vacuum = vi.fn().mockResolvedValue(undefined);
    const optimize = vi.fn().mockResolvedValue(undefined);
    const execute = vi.fn(async (callback, sql) => {
        let rows = [];
        if (sql.includes('database_list')) {
            rows = [
                [0, 'main', 'C:/Users/test/AppData/Roaming/VRCX/VRCX.sqlite3']
            ];
        } else if (sql.includes('page_count')) {
            rows = [[10]];
        } else if (sql.includes('page_size')) {
            rows = [[4096]];
        } else if (sql.includes('journal_mode')) {
            rows = [['wal']];
        } else if (sql.includes('name, sql')) {
            rows = [
                [
                    'feed_post',
                    'CREATE TABLE feed_post (id INTEGER PRIMARY KEY, message TEXT)'
                ],
                [
                    'user_location',
                    'CREATE TABLE user_location (id INTEGER PRIMARY KEY)'
                ]
            ];
        } else if (sql.includes('sqlite_master')) {
            rows = [['feed_post'], ['user_location']];
        } else if (sql.includes('COUNT(*)')) {
            rows = [
                ['feed_post', 3],
                ['user_location', 7]
            ];
        } else if (sql.includes('table_info')) {
            rows = [
                [0, 'id', 'INTEGER', 0, null, 1],
                [1, 'message', 'TEXT', 0, null, 0]
            ];
        } else if (sql.includes('LIMIT')) {
            rows = [
                [1, 'hello'],
                [2, 'world']
            ];
        }
        rows.forEach(callback);
    });
    return { push, vacuum, optimize, execute };
});

vi.mock('vue-router', () => ({
    useRouter: () => ({ push })
}));

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key) => key })
}));

vi.mock('vue-sonner', () => {
    const toast = vi.fn();
    toast.success = vi.fn();
    toast.error = vi.fn();
    toast.warning = vi.fn();
    toast.dismiss = vi.fn();
    return { toast };
});

vi.mock('@/services/sqlite', () => ({
    default: {
        execute: (cb, sql) => execute(cb, sql),
        executeNonQuery: vi.fn()
    }
}));

vi.mock('@/services/database', () => ({
    database: { vacuum, optimize }
}));

vi.mock('@/services/config.js', () => ({
    default: { getInt: vi.fn().mockResolvedValue(18) }
}));

vi.mock('../dialogs/DatabaseManagementDialog.vue', () => ({
    default: {
        name: 'DatabaseManagementDialog',
        props: ['visible', 'operation'],
        emits: ['close'],
        template: '<div class="db-dialog-stub" />'
    }
}));

import DatabaseManagement from '../DatabaseManagement.vue';

function findButtonByText(wrapper, textKey) {
    return wrapper
        .findAll('button')
        .find((node) => node.text().includes(textKey));
}

describe('DatabaseManagement.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('loads overview and table list on mount', async () => {
        const wrapper = mount(DatabaseManagement);
        await flushPromises();

        expect(wrapper.text()).toContain(
            'C:/Users/test/AppData/Roaming/VRCX/VRCX.sqlite3'
        );
        expect(wrapper.text()).toContain('40 KB');
        expect(wrapper.text()).toContain('wal');
        expect(wrapper.text()).toContain('view.tools.database_page.version');
        expect(wrapper.text()).toContain('18');
        expect(wrapper.text()).toContain('feed_post');
        expect(wrapper.text()).toContain('user_location');
        // 行数统计必须合并为单条查询（避免逐表串行往返）
        const countQueries = execute.mock.calls.filter(([, sql]) =>
            sql.includes('COUNT(*)')
        );
        expect(countQueries).toHaveLength(1);
    });

    test('selecting a table renders schema and row preview', async () => {
        const wrapper = mount(DatabaseManagement);
        await flushPromises();

        const tableButton = findButtonByText(wrapper, 'feed_post');
        expect(tableButton).toBeTruthy();
        await tableButton.trigger('click');
        await flushPromises();

        expect(wrapper.text()).toContain('CREATE TABLE feed_post');
        expect(wrapper.text()).toContain('hello');
        expect(wrapper.text()).toContain('world');
    });

    test('backup button opens the dialog with export operation', async () => {
        const wrapper = mount(DatabaseManagement);
        await flushPromises();

        const exportButton = findButtonByText(
            wrapper,
            'view.settings.advanced.advanced.db_export.button'
        );
        expect(exportButton).toBeTruthy();
        await exportButton.trigger('click');
        await flushPromises();

        const dialog = wrapper.findComponent({
            name: 'DatabaseManagementDialog'
        });
        expect(dialog.exists()).toBe(true);
        expect(dialog.props('visible')).toBe(true);
        expect(dialog.props('operation')).toBe('export');
    });

    test('optimize button runs vacuum and optimize', async () => {
        const wrapper = mount(DatabaseManagement);
        await flushPromises();

        const optimizeButton = findButtonByText(
            wrapper,
            'view.tools.database_page.optimize'
        );
        expect(optimizeButton).toBeTruthy();
        await optimizeButton.trigger('click');
        await flushPromises();

        expect(vacuum).toHaveBeenCalledTimes(1);
        expect(optimize).toHaveBeenCalledTimes(1);
    });
});
