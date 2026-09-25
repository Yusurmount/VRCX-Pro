import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    request: vi.fn(),
    watchState: {
        isAuthenticated: true,
        isLoggedIn: false,
        isFriendsLoaded: false
    }
}));

vi.mock('../../stores', () => ({
    useFriendStore: vi.fn(),
    useGalleryStore: vi.fn(),
    useGroupStore: vi.fn(),
    useInstanceStore: vi.fn(),
    useLocationStore: vi.fn(),
    useNotificationStore: vi.fn(),
    useSharedFeedStore: vi.fn(),
    useUiStore: vi.fn(),
    useUserStore: vi.fn()
}));

vi.mock('../../coordinators/userCoordinator', () => ({
    applyUser: vi.fn(),
    applyCurrentUser: vi.fn()
}));

vi.mock('../../coordinators/groupCoordinator', () => ({
    onGroupLeft: vi.fn(),
    applyGroup: vi.fn(),
    getGroupDialogGroup: vi.fn(),
    handleGroupMember: vi.fn()
}));

vi.mock('../../shared/utils', () => ({
    parseLocation: vi.fn()
}));

vi.mock('../appConfig', () => ({
    AppDebug: {
        websocketDomain: 'wss://example.test',
        debugWebSocket: false,
        errorNoty: null
    }
}));

vi.mock('../../api', () => ({
    groupRequest: {}
}));

vi.mock('../request', () => ({
    request: (...args) => mocks.request(...args)
}));

vi.mock('../../coordinators/friendPresenceCoordinator', () => ({
    runUpdateFriendFlow: vi.fn()
}));

vi.mock('../../coordinators/locationCoordinator', () => ({
    runSetCurrentUserLocationFlow: vi.fn()
}));

vi.mock('../../stores/notificationRules', () => ({
    useNotificationRulesStore: vi.fn()
}));

vi.mock('../watchState', () => ({
    watchState: mocks.watchState
}));

import { initWebsocket } from '../websocket.js';

describe('initWebsocket', () => {
    let webSocketConstructor;

    beforeEach(() => {
        mocks.request.mockReset().mockResolvedValue({ ok: true, token: 'token' });
        mocks.watchState.isAuthenticated = true;
        mocks.watchState.isLoggedIn = false;
        mocks.watchState.isFriendsLoaded = false;
        webSocketConstructor = vi.fn();
        global.WebSocket = webSocketConstructor;
    });

    test('connects after authentication without waiting for friends or database readiness', async () => {
        initWebsocket();

        await vi.waitFor(() => {
            expect(webSocketConstructor).toHaveBeenCalledTimes(1);
        });
        expect(mocks.request).toHaveBeenCalledWith('auth', { method: 'GET' });
        expect(mocks.watchState.isFriendsLoaded).toBe(false);
    });
});
