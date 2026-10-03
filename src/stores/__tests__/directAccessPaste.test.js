import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

import en from '../../localization/en.json';

vi.mock('../../views/Feed/Feed.vue', () => ({
    default: { template: '<div />' }
}));
vi.mock('../../views/Feed/columns.jsx', () => ({ columns: [] }));
vi.mock('../../plugins/router', () => ({
    router: {
        beforeEach: vi.fn(),
        push: vi.fn(),
        replace: vi.fn(),
        currentRoute: ref({ path: '/', name: '', meta: {} }),
        isReady: vi.fn().mockResolvedValue(true)
    },
    initRouter: vi.fn()
}));
vi.mock('vue-router', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useRouter: vi.fn(() => ({
            push: vi.fn(),
            replace: vi.fn(),
            currentRoute: ref({ path: '/', name: '', meta: {} })
        }))
    };
});
vi.mock('../../plugins/interopApi', () => ({ initInteropApi: vi.fn() }));
vi.mock('../../services/database', () => ({
    database: new Proxy(
        {},
        {
            get: (_target, prop) => {
                if (prop === '__esModule') return false;
                return vi.fn().mockResolvedValue(null);
            }
        }
    )
}));
vi.mock('../../services/config', () => ({
    default: {
        init: vi.fn(),
        getString: vi.fn().mockResolvedValue('{}'),
        setString: vi.fn(),
        getBool: vi.fn().mockImplementation((_k, d) => d ?? false),
        setBool: vi.fn(),
        getInt: vi.fn().mockImplementation((_k, d) => d ?? 0),
        setInt: vi.fn(),
        getFloat: vi.fn().mockImplementation((_k, d) => d ?? 0),
        setFloat: vi.fn(),
        getObject: vi.fn().mockReturnValue(null),
        setObject: vi.fn(),
        getArray: vi.fn().mockReturnValue([]),
        setArray: vi.fn(),
        remove: vi.fn()
    }
}));
vi.mock('../../services/jsonStorage', () => ({ default: vi.fn() }));
vi.mock('../../services/watchState', () => ({
    watchState: { isLoggedIn: false }
}));
vi.mock('vue-i18n', async (importOriginal) => {
    const actual = await importOriginal();
    const i18n = actual.createI18n({
        locale: 'en',
        fallbackLocale: 'en',
        legacy: false,
        missingWarn: false,
        fallbackWarn: false,
        messages: { en }
    });
    return {
        ...actual,
        useI18n: () => i18n.global
    };
});

const mockShowUserDialog = vi.fn();
const mockShowAvatarDialog = vi.fn();
const mockShowGroupDialog = vi.fn();
const mockShowWorldDialog = vi.fn();
const mockPrompt = vi.fn();

vi.mock('../user', () => ({
    useUserStore: () => ({
        cachedUsers: new Map(),
        showUserDialogHistory: new Set(),
        currentUser: ref({ id: 'usr_me', homeLocation: '' })
    })
}));
vi.mock('../avatar', () => ({ useAvatarStore: () => ({}) }));
vi.mock('../group', () => ({ useGroupStore: () => ({}) }));
vi.mock('../world', () => ({ useWorldStore: () => ({}) }));
vi.mock('../friend', () => ({ useFriendStore: () => ({ friends: new Map() }) }));
vi.mock('../modal', () => ({
    useModalStore: () => ({
        prompt: (...args) => mockPrompt(...args)
    })
}));
vi.mock('../settings/appearance', () => ({
    useAppearanceSettingsStore: () => ({ appLanguage: 'en' })
}));

function makeApiMock() {
    return {
        instanceRequest: {
            getInstanceFromShortName: vi.fn().mockResolvedValue({
                json: { location: '', shortName: '' }
            })
        },
        userRequest: { getUsers: vi.fn().mockResolvedValue({ json: [] }) },
        groupRequest: {
            groupStrictsearch: vi.fn().mockResolvedValue({ json: [] })
        },
        queryRequest: {},
        miscRequest: {}
    };
}
vi.mock('../../api', () => makeApiMock());
vi.mock('../../api/', () => makeApiMock());

vi.mock('../../coordinators/userCoordinator', () => ({
    showUserDialog: (...args) => mockShowUserDialog(...args),
    lookupUser: vi.fn(),
    applyUser: vi.fn()
}));
vi.mock('../../coordinators/avatarCoordinator', () => ({
    showAvatarDialog: (...args) => mockShowAvatarDialog(...args),
    getAvatarName: vi.fn()
}));
vi.mock('../../coordinators/groupCoordinator', () => ({
    showGroupDialog: (...args) => mockShowGroupDialog(...args)
}));
vi.mock('../../coordinators/worldCoordinator', () => ({
    showWorldDialog: (...args) => mockShowWorldDialog(...args)
}));

vi.mock('vue-sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        dismiss: vi.fn()
    }
}));

import { useSearchStore } from '../search';

describe('directAccessPaste prompt fallback', () => {
    let store;

    beforeEach(() => {
        setActivePinia(createPinia());
        store = useSearchStore();
        vi.clearAllMocks();
        // prompt promise stays pending like a dialog waiting for user input
        mockPrompt.mockReturnValue(new Promise(() => {}));
        window.platform.getClipboardText = vi.fn();
    });

    test('opens prompt dialog when clipboard read rejects', async () => {
        window.platform.getClipboardText.mockRejectedValue(
            new Error('clipboard unavailable')
        );

        await store.directAccessPaste();

        expect(mockPrompt).toHaveBeenCalledTimes(1);
    });

    test('opens prompt dialog when clipboard parse throws', async () => {
        window.platform.getClipboardText.mockResolvedValue(
            'https://vrchat. bad-url'
        );

        await store.directAccessPaste();

        expect(mockPrompt).toHaveBeenCalledTimes(1);
    });

    test('opens prompt dialog for unparseable clipboard text', async () => {
        window.platform.getClipboardText.mockResolvedValue('hello world');

        await store.directAccessPaste();

        expect(mockPrompt).toHaveBeenCalledTimes(1);
    });

    test('does not open prompt when clipboard already resolves a target', async () => {
        window.platform.getClipboardText.mockResolvedValue('usr_abc123');

        await store.directAccessPaste();

        expect(mockPrompt).not.toHaveBeenCalled();
        expect(mockShowUserDialog).toHaveBeenCalledWith('usr_abc123');
    });
});
