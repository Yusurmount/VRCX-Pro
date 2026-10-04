import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import { setActivePinia } from 'pinia';

vi.mock('vue-i18n', () => ({
    useI18n: () => {
        const { ref } = require('vue');
        return {
            t: (key, params) =>
                params ? `${key}:${JSON.stringify(params)}` : key,
            locale: ref('en')
        };
    },
    createI18n: () => ({
        global: { t: (key) => key },
        install: vi.fn()
    })
}));

vi.mock('../../plugins/router', () => {
    const { ref } = require('vue');
    return {
        router: {
            beforeEach: vi.fn(),
            push: vi.fn(),
            replace: vi.fn(),
            currentRoute: ref({ path: '/', name: '', meta: {} }),
            isReady: vi.fn().mockResolvedValue(true)
        },
        initRouter: vi.fn()
    };
});

vi.mock('vue-router', async (importOriginal) => {
    const actual = await importOriginal();
    const { ref } = require('vue');
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
        getString: vi.fn().mockImplementation((_k, d) => d ?? '{}'),
        setString: vi.fn(),
        getBool: vi.fn().mockImplementation((_k, d) => d ?? false),
        setBool: vi.fn(),
        getInt: vi.fn().mockImplementation((_k, d) => d ?? 0),
        setInt: vi.fn(),
        getFloat: vi.fn().mockImplementation((_k, d) => d ?? 0),
        setFloat: vi.fn(),
        getObject: vi.fn().mockReturnValue(null),
        setObject: vi.fn(),
        getArray: vi.fn().mockImplementation((_k, d) => d ?? []),
        setArray: vi.fn(),
        remove: vi.fn()
    }
}));
vi.mock('../../services/jsonStorage', () => ({ default: vi.fn() }));
vi.mock('../../services/watchState', () => ({
    watchState: { isLoggedIn: false }
}));
vi.mock('../../services/request', () => ({
    request: vi.fn().mockResolvedValue({ json: {} }),
    processBulk: vi.fn(),
    buildRequestInit: vi.fn(),
    parseResponse: vi.fn(),
    shouldIgnoreError: vi.fn(),
    $throw: vi.fn(),
    failedGetRequests: new Map()
}));
vi.mock('../../stores/settings/general', () => ({
    useGeneralSettingsStore: () => ({ localFavoriteFriendsGroups: {} })
}));

import { useUserPresence } from '../useUserPresence';
import {
    useGameStore,
    useLocationStore,
    useUserStore
} from '../../stores';

const MY_LOCATION = 'wrld_1:12345~region(us)';

/**
 * @param {{inPlayerList?: boolean, gameRunning?: boolean}} opts
 */
function setup(opts = {}) {
    const { inPlayerList = false, gameRunning = true } = opts;
    const pinia = createTestingPinia({ stubActions: true });
    setActivePinia(pinia);

    const userStore = useUserStore(pinia);
    userStore.currentUser.id = 'usr_me';

    const locationStore = useLocationStore(pinia);
    locationStore.$patch({
        lastLocation: {
            location: MY_LOCATION,
            playerList: new Map(
                inPlayerList
                    ? [
                          [
                              'usr_stranger',
                              {
                                  displayName: 'Stranger',
                                  userId: 'usr_stranger',
                                  joinTime: 1700000000000,
                                  lastAvatar: ''
                              }
                          ]
                      ]
                    : []
            ),
            friendList: new Map()
        }
    });

    const gameStore = useGameStore(pinia);
    gameStore.$patch({ isGameRunning: gameRunning });

    return useUserPresence();
}

describe('useUserPresence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('derives online presence for a stranger in the current instance', () => {
        const { resolveFor } = setup({ inPlayerList: true });
        const resolved = resolveFor({
            id: 'usr_stranger',
            isFriend: false,
            state: 'offline',
            status: 'offline',
            location: 'offline'
        });
        expect(resolved.state).toBe('online');
        expect(resolved.location).toBe(MY_LOCATION);
        expect(resolved.$online_for).toBe(1700000000000);
    });

    test('keeps API data when the stranger is not in the current instance', () => {
        const { resolveFor } = setup({ inPlayerList: false });
        const ref = {
            id: 'usr_stranger',
            isFriend: false,
            state: 'offline',
            status: 'offline',
            location: 'offline'
        };
        expect(resolveFor(ref)).toBe(ref);
    });

    test('keeps API data while the game is not running', () => {
        const { resolveFor } = setup({ inPlayerList: true, gameRunning: false });
        const ref = {
            id: 'usr_stranger',
            isFriend: false,
            state: 'offline',
            status: 'offline',
            location: 'offline'
        };
        expect(resolveFor(ref)).toBe(ref);
    });

    test('never derives presence for friends', () => {
        const { resolveFor } = setup({ inPlayerList: true });
        const friend = {
            id: 'usr_stranger',
            isFriend: true,
            state: 'offline',
            status: 'offline',
            location: 'offline'
        };
        expect(resolveFor(friend)).toBe(friend);
    });
});
