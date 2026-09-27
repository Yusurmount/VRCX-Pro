import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    advancedStore: { gameLogDisabled: false },
    friendStore: { friends: new Map() },
    galleryStore: { trySaveStickerToFile: vi.fn() },
    gameStore: { isGameRunning: false },
    gameLogStore: {
        state: { lastLocationAvatarList: new Map() },
        addGameLog: vi.fn(),
        addGamelogLocationToDatabase: vi.fn(),
        clearNowPlaying: vi.fn(),
        resetLastMediaUrls: vi.fn()
    },
    generalStore: { udonExceptionLogging: false },
    instanceStore: {
        addInstanceJoinHistory: vi.fn(),
        removeQueuedInstance: vi.fn(),
        updateCurrentInstanceWorld: vi.fn(),
        getCurrentInstanceUserList: vi.fn(),
        applyWorldDialogInstances: vi.fn(),
        applyGroupDialogInstances: vi.fn()
    },
    locationStore: {
        lastLocation: { location: 'wrld_old:1' },
        setLastLocation: vi.fn(),
        setLastLocationLocation: vi.fn(),
        setLastLocationDestination: vi.fn(),
        setLastLocationDestinationTime: vi.fn()
    },
    notificationStore: { queueGameLogNoty: vi.fn() },
    sharedFeedStore: { addEntry: vi.fn() },
    userStore: {
        cachedUsers: new Map(),
        cachedUserIdsByDisplayName: new Map(),
        currentUser: { id: 'usr_me' },
        applyUserDialogLocation: vi.fn()
    },
    vrStore: { updateVRLastLocation: vi.fn() },
    vrcxStore: { ipcEnabled: false },
    runLastLocationResetFlow: vi.fn(),
    runUpdateCurrentUserLocationFlow: vi.fn(),
    parseRawGameLog: vi.fn()
}));

vi.mock('../../shared/utils', () => ({
    createJoinLeaveEntry: vi.fn(),
    createLocationEntry: vi.fn(() => ({ type: 'Location' })),
    createPortalSpawnEntry: vi.fn(),
    createResourceLoadEntry: vi.fn(),
    findUserByDisplayName: vi.fn(),
    parseLocation: vi.fn(() => ({ worldId: 'wrld_new' })),
    parseInventoryFromUrl: vi.fn(),
    parsePrintFromUrl: vi.fn(),
    replaceBioSymbols: vi.fn((value) => value),
    getGroupName: vi.fn(async () => '')
}));

vi.mock('../plugins/i18n', () => ({
    i18n: { global: { t: (key) => key } }
}));

vi.mock('../../services/appConfig', () => ({
    AppDebug: {
        debugGameLog: false,
        debugWebRequests: false
    },
    logWebRequest: vi.fn()
}));

vi.mock('../../services/database', () => ({
    database: new Proxy(
        {},
        {
            get: (_target, property) => {
                if (property === '__esModule') return false;
                return vi.fn().mockResolvedValue(undefined);
            }
        }
    )
}));

vi.mock('../locationCoordinator', () => ({
    runLastLocationResetFlow: (...args) =>
        mocks.runLastLocationResetFlow(...args),
    runUpdateCurrentUserLocationFlow: (...args) =>
        mocks.runUpdateCurrentUserLocationFlow(...args)
}));

vi.mock('../../api', () => ({
    userRequest: { getUser: vi.fn() }
}));

vi.mock('../../services/watchState', () => ({
    watchState: {}
}));

vi.mock('vue-sonner', () => ({
    toast: {}
}));

vi.mock('../../stores/settings/advanced', () => ({
    useAdvancedSettingsStore: () => mocks.advancedStore
}));

vi.mock('../../stores/friend', () => ({
    useFriendStore: () => mocks.friendStore
}));

vi.mock('../../stores/gallery', () => ({
    useGalleryStore: () => mocks.galleryStore
}));

vi.mock('../../stores/game', () => ({
    useGameStore: () => mocks.gameStore
}));

vi.mock('../../stores/gameLog', () => ({
    useGameLogStore: () => mocks.gameLogStore
}));

vi.mock('../../stores/settings/general', () => ({
    useGeneralSettingsStore: () => mocks.generalStore
}));

vi.mock('../../stores/instance', () => ({
    useInstanceStore: () => mocks.instanceStore
}));

vi.mock('../../stores/location', () => ({
    useLocationStore: () => mocks.locationStore
}));

vi.mock('../../stores/modal', () => ({
    useModalStore: () => ({})
}));

vi.mock('../../stores/notification', () => ({
    useNotificationStore: () => mocks.notificationStore
}));

vi.mock('../../stores/photon', () => ({
    usePhotonStore: () => ({})
}));

vi.mock('../../stores/sharedFeed', () => ({
    useSharedFeedStore: () => mocks.sharedFeedStore
}));

vi.mock('../../stores/user', () => ({
    useUserStore: () => mocks.userStore
}));

vi.mock('../../stores/vr', () => ({
    useVrStore: () => mocks.vrStore
}));

vi.mock('../../stores/vrcx', () => ({
    useVrcxStore: () => mocks.vrcxStore
}));

vi.mock('../../services/gameLog.js', () => ({
    default: {
        parseRawGameLog: (...args) => mocks.parseRawGameLog(...args)
    }
}));

vi.mock('worker-timers', () => ({
    setTimeout: vi.fn()
}));

vi.mock('../../services/config', () => ({
    default: {}
}));

import { addGameLogEntry, addGameLogEvent } from '../gameLogCoordinator';

describe('addGameLogEvent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.gameStore.isGameRunning = false;
        mocks.locationStore.lastLocation.location = 'wrld_old:1';
        mocks.parseRawGameLog.mockReturnValue({
            type: 'location',
            dt: '2026-09-26T12:00:00.000Z',
            location: 'wrld_new:2~region(jp)',
            worldName: 'New Room'
        });
    });

    test('applies a live room change when process detection is stale', () => {
        addGameLogEvent('[]');

        expect(mocks.locationStore.setLastLocation).toHaveBeenCalledWith(
            expect.objectContaining({
                location: 'wrld_new:2~region(jp)',
                name: 'New Room'
            })
        );
        expect(
            mocks.instanceStore.updateCurrentInstanceWorld
        ).toHaveBeenCalledTimes(1);
        expect(
            mocks.instanceStore.getCurrentInstanceUserList
        ).toHaveBeenCalled();
    });

    test('does not apply historical room changes when the game is not running', () => {
        addGameLogEntry(
            {
                type: 'location',
                dt: '2026-09-26T12:00:00.000Z',
                location: 'wrld_new:2~region(jp)',
                worldName: 'New Room'
            },
            'wrld_old:1'
        );

        expect(mocks.locationStore.setLastLocation).not.toHaveBeenCalled();
    });
});
