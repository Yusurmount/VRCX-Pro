import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../services/database', () => ({
    database: { optimize: vi.fn() }
}));

vi.mock('../../api', () => ({
    groupRequest: { getUsersGroupInstances: vi.fn() }
}));

vi.mock('../../coordinators/friendSyncCoordinator', () => ({
    runRefreshFriendsListFlow: vi.fn()
}));

vi.mock('../../coordinators/gameCoordinator', () => ({
    runUpdateIsGameRunningFlow: vi.fn()
}));

vi.mock('../../coordinators/gameLogCoordinator', () => ({
    addGameLogEvent: vi.fn()
}));

vi.mock('../../coordinators/moderationCoordinator', () => ({
    runRefreshPlayerModerationsFlow: vi.fn()
}));

vi.mock('../../coordinators/vrcxCoordinator', () => ({
    clearVRCXCache: vi.fn()
}));

vi.mock('../../coordinators/groupCoordinator', () => ({
    handleGroupUserInstances: vi.fn()
}));

vi.mock('../../coordinators/userCoordinator', () => ({
    getCurrentUser: vi.fn(),
    updateAutoStateChange: vi.fn()
}));

vi.mock('../auth', () => ({
    useAuthStore: () => ({ updateStoredUser: vi.fn() })
}));

vi.mock('../settings/discordPresence', () => ({
    useDiscordPresenceSettingsStore: () => ({
        discordActive: false,
        updateDiscord: vi.fn()
    })
}));

vi.mock('../friend', () => ({
    useFriendStore: () => ({ setIsRefreshFriendsLoading: vi.fn() })
}));

vi.mock('../user', () => ({
    useUserStore: () => ({ currentUser: {} })
}));

vi.mock('../vrcxUpdater', () => ({
    useVRCXUpdaterStore: () => ({
        autoUpdateVRCX: 'Off',
        checkForVRCXUpdate: vi.fn()
    })
}));

vi.mock('../vr', () => ({
    useVrStore: () => ({ vrInit: vi.fn() })
}));

vi.mock('../vrcx', () => ({
    useVrcxStore: () => ({
        setIpcEnabled: vi.fn(),
        clearVRCXCacheFrequency: 0,
        tryAutoBackupVrcRegistry: vi.fn()
    })
}));

vi.mock('../../services/watchState', () => ({
    watchState: { isLoggedIn: false }
}));

vi.mock('worker-timers', () => ({
    setTimeout: vi.fn()
}));

import { useUpdateLoopStore } from '../updateLoop';

describe('useUpdateLoopStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    test('exposes polling state reactively so external readers observe updates', () => {
        const store = useUpdateLoopStore();

        expect(store.nextCurrentUserRefresh).toBe(300);

        store.setNextCurrentUserRefresh(42);

        expect(store.nextCurrentUserRefresh).toBe(42);
    });
});
