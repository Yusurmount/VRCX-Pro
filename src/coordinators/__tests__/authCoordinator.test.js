import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    applyCurrentUser: vi.fn(),
    closeWebSocket: vi.fn(),
    initWebsocket: vi.fn(),
    watchState: {
        isAuthenticated: false,
        isLoggedIn: false,
        isFriendsLoaded: false,
        isFavoritesLoaded: false
    }
}));

vi.mock('../../plugins/i18n', () => ({
    i18n: { global: { t: (key) => key } }
}));

vi.mock('vue-sonner', () => ({
    toast: { success: vi.fn() }
}));

vi.mock('../../services/websocket', () => ({
    closeWebSocket: (...args) => mocks.closeWebSocket(...args),
    initWebsocket: (...args) => mocks.initWebsocket(...args)
}));

vi.mock('../../queries', () => ({
    queryClient: { clear: vi.fn() }
}));

vi.mock('../../stores/auth', () => ({
    useAuthStore: () => ({})
}));

vi.mock('../../stores/notification', () => ({
    useNotificationStore: () => ({})
}));

vi.mock('../../stores/updateLoop', () => ({
    useUpdateLoopStore: () => ({
        setNextCurrentUserRefresh: vi.fn()
    })
}));

vi.mock('../../stores/user', () => ({
    useUserStore: () => ({})
}));

vi.mock('../userCoordinator', () => ({
    applyCurrentUser: (...args) => mocks.applyCurrentUser(...args)
}));

vi.mock('../../services/watchState', () => ({
    watchState: mocks.watchState
}));

vi.mock('../../services/config', () => ({
    default: {}
}));

vi.mock('../../services/webapi', () => ({
    default: {}
}));

import { runLoginSuccessFlow } from '../authCoordinator.js';

describe('runLoginSuccessFlow', () => {
    beforeEach(() => {
        mocks.applyCurrentUser.mockClear();
        mocks.initWebsocket.mockClear();
        mocks.watchState.isAuthenticated = false;
    });

    test('marks authentication before starting WebSocket initialization', () => {
        const currentUser = { id: 'usr_123' };

        runLoginSuccessFlow(currentUser);

        expect(mocks.applyCurrentUser).toHaveBeenCalledWith(currentUser);
        expect(mocks.watchState.isAuthenticated).toBe(true);
        expect(mocks.initWebsocket).toHaveBeenCalledTimes(1);
        expect(mocks.initWebsocket.mock.invocationCallOrder[0]).toBeGreaterThan(
            mocks.applyCurrentUser.mock.invocationCallOrder[0]
        );
    });
});
