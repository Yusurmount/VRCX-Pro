import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
    getFriends: vi.fn(),
    getUser: vi.fn(),
    getString: vi.fn(),
    getInt: vi.fn(),
    getMaxFriendLogNumber: vi.fn(),
    getFriendLogCurrent: vi.fn(),
    currentRoute: { name: 'home', params: {} },
    favoriteStore: {
        cachedFavorites: new Map(),
        localFriendFavorites: {}
    }
}));

vi.mock('../../api', () => ({
    friendRequest: { getFriends: mocks.getFriends },
    userRequest: { getUser: mocks.getUser }
}));

vi.mock('../../shared/utils', () => ({
    compareByCreatedAtAscending: () => 0,
    createRateLimiter: () => ({ wait: () => Promise.resolve() }),
    executeWithBackoff: (callback) => callback(),
    getFriendsSortFunction: () => () => 0,
    isRealInstance: () => true
}));

vi.mock('../../coordinators/friendSyncCoordinator', () => ({
    runInitFriendsListFlow: vi.fn()
}));

vi.mock('../../coordinators/memoCoordinator', () => ({
    getUserMemo: vi.fn()
}));

vi.mock('../../services/websocket', () => ({
    prewarmAuthToken: vi.fn()
}));

vi.mock('../../coordinators/friendPresenceCoordinator', () => ({
    runPendingOfflineTickFlow: vi.fn(),
    runUpdateFriendFlow: vi.fn()
}));

vi.mock('../../coordinators/searchIndexCoordinator', () => ({
    syncFriendSearchIndex: vi.fn()
}));

vi.mock('../../coordinators/friendRelationshipCoordinator', () => ({
    updateFriendship: vi.fn(),
    runUpdateFriendshipsFlow: vi.fn()
}));

vi.mock('../../coordinators/userCoordinator', () => ({
    applyUser: vi.fn()
}));

vi.mock('../../services/appConfig', () => ({
    AppDebug: {
        debugFriendState: false,
        debugRecompute: false,
        dontLogMeOut: false
    }
}));

vi.mock('../../services/database', () => ({
    database: {
        getMaxFriendLogNumber: mocks.getMaxFriendLogNumber,
        getFriendLogCurrent: mocks.getFriendLogCurrent
    }
}));

vi.mock('../../services/config', () => ({
    default: {
        getBool: vi.fn(),
        getInt: mocks.getInt,
        getString: mocks.getString
    }
}));

vi.mock('vue-router', async () => {
    const { ref } = await import('vue');
    return {
        useRouter: () => ({ currentRoute: ref(mocks.currentRoute) })
    };
});

vi.mock('../settings/appearance', () => ({
    useAppearanceSettingsStore: () => ({ sidebarSortMethods: [] })
}));

vi.mock('../settings/general', () => ({
    useGeneralSettingsStore: () => ({ localFavoriteFriendsGroups: {} })
}));

vi.mock('../favorite', () => ({
    useFavoriteStore: () => mocks.favoriteStore
}));

vi.mock('../group', () => ({
    useGroupStore: () => ({ clearGroupInstances: vi.fn() })
}));

vi.mock('../location', () => ({
    useLocationStore: () => ({
        lastLocation: { friendList: new Set(), location: '' }
    })
}));

vi.mock('../dashboard', () => ({
    useDashboardStore: () => ({
        dashboards: [],
        getDashboard: () => false
    })
}));

const userStore = {
    currentUser: null,
    cachedUsers: new Map()
};

vi.mock('../user', () => ({
    useUserStore: () => userStore
}));

import { watchState } from '../../services/watchState';
import { useFriendStore } from '../friend';

describe('friend initialization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setActivePinia(createPinia());
        watchState.isLoggedIn = true;
        watchState.isFriendsLoaded = false;
        userStore.currentUser = null;
        userStore.cachedUsers = new Map();
        mocks.getString.mockResolvedValue('[]');
        mocks.getInt.mockResolvedValue(0);
        mocks.getMaxFriendLogNumber.mockResolvedValue(0);
        mocks.getFriendLogCurrent.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('loads friend status before the bulk refresh', async () => {
        const currentUser = {
            id: 'usr_me',
            friends: ['usr_1'],
            offlineFriends: [],
            activeFriends: [],
            onlineFriends: ['usr_1']
        };
        const apiFriend = {
            id: 'usr_1',
            displayName: 'Friend One',
            platform: 'pc',
            location: 'offline'
        };
        userStore.currentUser = currentUser;
        mocks.getFriends.mockImplementation(async ({ offline, offset }) => ({
            json: !offline && offset === 0 ? [apiFriend] : []
        }));
        mocks.getUser.mockResolvedValue({ json: apiFriend });

        const store = useFriendStore();
        await store.getFriendLog(currentUser);

        expect(store.friends.get('usr_1').state).toBe('online');
        expect(mocks.getUser).not.toHaveBeenCalled();
        expect(store.isRefreshFriendsLoading).toBe(false);
    });

    test('keeps friends loaded when the initial API refresh fails', async () => {
        const currentUser = {
            id: 'usr_me',
            friends: ['usr_1'],
            offlineFriends: [],
            activeFriends: [],
            onlineFriends: ['usr_1']
        };
        userStore.currentUser = currentUser;
        mocks.getFriends.mockRejectedValueOnce(
            new Error('SSL connection failed')
        );
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const store = useFriendStore();
        await store.initFriendLog(currentUser);

        expect(watchState.isLoggedIn).toBe(true);
        expect(watchState.isFriendsLoaded).toBe(true);
        expect(store.friends.get('usr_1').state).toBe('online');
        expect(store.isRefreshFriendsLoading).toBe(false);
        expect(warn).toHaveBeenCalled();
    });
});
