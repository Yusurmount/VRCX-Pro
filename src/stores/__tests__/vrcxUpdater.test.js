import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
    configRepository: {
        getString: vi.fn(),
        setString: vi.fn()
    },
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn()
    }
}));

vi.mock('../../services/config', () => ({
    default: mocks.configRepository
}));

vi.mock('../../services/appConfig', () => ({
    logWebRequest: vi.fn()
}));

vi.mock('vue-sonner', () => ({
    toast: mocks.toast
}));

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key) => key,
        locale: require('vue').ref('en')
    })
}));

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

import { useVRCXUpdaterStore } from '../vrcxUpdater';

describe('useVRCXUpdaterStore.setAutoUpdateVRCX', () => {
    beforeEach(async () => {
        mocks.configRepository.getString.mockImplementation(
            (key, defaultValue) => {
                if (key === 'VRCX_autoUpdateVRCX') {
                    return Promise.resolve('Off');
                }
                if (key === 'VRCX_id') {
                    return Promise.resolve('test-vrcx-id');
                }
                if (key === 'VRCX_lastVRCXVersion') {
                    return Promise.resolve('2026.1.0');
                }
                return Promise.resolve(defaultValue ?? '');
            }
        );
        mocks.configRepository.setString.mockResolvedValue(undefined);

        globalThis.AppApi = {
            GetVersion: vi.fn().mockResolvedValue('2026.1.0')
        };
        globalThis.webApiService = {
            execute: vi.fn()
        };

        setActivePinia(createPinia());
        useVRCXUpdaterStore();
        await flushPromises();
        vi.clearAllMocks();
    });

    test('sets autoUpdateVRCX to Off, clears pending flag, and persists config', async () => {
        const store = useVRCXUpdaterStore();
        store.pendingVRCXUpdate = true;

        await store.setAutoUpdateVRCX('Off');

        expect(store.autoUpdateVRCX).toBe('Off');
        expect(store.pendingVRCXUpdate).toBe(false);
        expect(mocks.configRepository.setString).toHaveBeenCalledWith(
            'VRCX_autoUpdateVRCX',
            'Off'
        );
    });

    test('updates autoUpdateVRCX for non-Off values and keeps pending flag', async () => {
        const store = useVRCXUpdaterStore();
        store.pendingVRCXUpdate = true;

        await store.setAutoUpdateVRCX('Notify');

        expect(store.autoUpdateVRCX).toBe('Notify');
        expect(store.pendingVRCXUpdate).toBe(true);
        expect(mocks.configRepository.setString).toHaveBeenCalledWith(
            'VRCX_autoUpdateVRCX',
            'Notify'
        );
    });

    test('loads the change log from GitHub releases', async () => {
        const release = {
            name: 'VRCX-Pro 2026.2.0',
            tag_name: 'v2026.2.0',
            body: '## Improvements\n- Updated release notes',
            assets: []
        };
        globalThis.webApiService.execute.mockResolvedValue({
            status: 200,
            data: JSON.stringify([release])
        });
        const store = useVRCXUpdaterStore();

        const result = await store.showChangeLogDialog({ prefetch: true });

        expect(result).toEqual({ shown: true, checkedForUpdates: true });
        expect(globalThis.webApiService.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'https://api.github.com/repos/Yusurmount/VRCX-Pro/releases',
                method: 'GET'
            })
        );
        expect(store.changeLogDialog.buildName).toBe(release.name);
        expect(store.changeLogDialog.changeLog).toBe(release.body);
        expect(store.changeLogDialog.loaded).toBe(true);
        expect(store.changeLogDialog.loading).toBe(false);
        expect(store.latestAppVersion).toBe(release.tag_name);
        expect(store.pendingVRCXUpdate).toBe(true);
    });

    test('does not mark an update when the current version exceeds the release', async () => {
        const store = useVRCXUpdaterStore();
        store.appVersion = 'VRCX-Pro 2026.3.0';
        globalThis.webApiService.execute.mockResolvedValue({
            status: 200,
            data: JSON.stringify([
                {
                    name: 'VRCX-Pro 2026.2.0',
                    tag_name: 'v2026.2.0',
                    body: 'Older release',
                    assets: []
                }
            ])
        });

        await store.showChangeLogDialog({ prefetch: true });

        expect(store.latestAppVersion).toBe('v2026.2.0');
        expect(store.pendingVRCXUpdate).toBe(false);
    });
});
