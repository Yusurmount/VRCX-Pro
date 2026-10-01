vi.mock('../../ipc/interopApi.js', () => {
    const AppApi = {
        SetUserAgent: vi.fn(() => true),
        GetSomething: vi.fn(() => 'value')
    };
    return {
        default: {
            AppApi,
            WebApi: {},
            VRCXStorage: {},
            SQLite: {},
            LogWatcher: {},
            Discord: {},
            AssetBundleManager: {}
        }
    };
});
vi.mock('../../services/config.js', () => ({
    default: { init: vi.fn() }
}));
vi.mock('../../services/jsonStorage.js', () => ({
    default: class JsonStorageMock {}
}));

import { initInteropApi } from '../interopApi.js';
import InteropApi from '../../ipc/interopApi.js';

describe('initInteropApi AppApi zoom routing', () => {
    beforeEach(async () => {
        await initInteropApi();
    });

    test('routes SetZoom/GetZoom to the window zoom service', async () => {
        await expect(window.AppApi.GetZoom()).resolves.toBe(0);
        await window.AppApi.SetZoom(-1);
        await expect(window.AppApi.GetZoom()).resolves.toBe(-1);
    });

    test('passes every other AppApi method through to the sidecar proxy', async () => {
        window.AppApi.SetUserAgent();
        expect(InteropApi.AppApi.SetUserAgent).toHaveBeenCalled();
        expect(window.AppApi.GetSomething()).toBe('value');
    });
});
