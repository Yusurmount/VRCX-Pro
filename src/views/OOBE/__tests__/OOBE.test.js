import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

vi.mock('vue-router', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useRouter: () => ({
            push: vi.fn(),
            replace: vi.fn(),
            resolve: vi.fn(),
            currentRoute: { query: {} }
        }),
        useRoute: () => ({ query: {} })
    };
});

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key) => key })
}));

vi.mock('pinia', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, storeToRefs: (store) => store };
});

vi.mock('vue-sonner', () => {
    const toast = vi.fn();
    toast.success = vi.fn();
    toast.error = vi.fn();
    return { toast };
});

vi.mock('@/stores', () => ({
    useAuthStore: () => ({
        loginForm: { value: { username: '', password: '' } },
        getAllSavedCredentials: vi.fn().mockResolvedValue({}),
        login: vi.fn(),
        relogin: vi.fn()
    }),
    useGeneralSettingsStore: () => ({
        isCloseToTray: { value: true },
        isStartAtWindowsStartup: { value: false },
        isStartAsMinimizedState: { value: false },
        setIsCloseToTray: vi.fn(),
        setIsStartAtWindowsStartup: vi.fn(),
        setIsStartAsMinimizedState: vi.fn()
    }),
    useAppearanceSettingsStore: () => ({
        appLanguage: { value: 'en' },
        isDarkMode: { value: true },
        changeAppLanguage: vi.fn(),
        toggleThemeMode: vi.fn()
    }),
    useUserStore: () => ({ currentUser: null })
}));

vi.mock('@/localization', () => ({
    getLanguageName: (code) => code,
    languageCodes: []
}));

vi.mock('@/services/watchState', () => ({
    watchState: { isLoggedIn: false }
}));

vi.mock('@/services/oobe', () => ({
    completeOobe: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@/services/database/exportImport', () => ({
    executeImport: vi.fn(),
    readImportFile: vi.fn()
}));

vi.mock('@/composables/useUserDisplay', () => ({
    useUserDisplay: () => ({ userImage: vi.fn(() => '') })
}));

import OOBE from '../OOBE.vue';

describe('OOBE', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('renders the wizard shell with step-1 welcome panel', async () => {
        const wrapper = mount(OOBE);
        await flushPromises();

        const html = wrapper.html();
        expect(html).toContain('wizard-shell');
        expect(html).toContain('oobe.welcome.title');
        expect(html).toContain('oobe.welcome.cta');
        expect(wrapper.find('.oobe-vrcx-logo').exists()).toBe(true);
        expect(wrapper.findAll('.wiz-progress-dot')).toHaveLength(7);
        expect(wrapper.findAll('.wiz-progress-dot.active')).toHaveLength(1);
    });
});
