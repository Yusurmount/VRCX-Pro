import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
    configRepository: {
        getString: vi.fn(),
        setString: vi.fn(),
        getBool: vi.fn(),
        setBool: vi.fn()
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
        t: (key, params) =>
            params ? `${key} ${Object.values(params).join(' ')}` : key,
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
        mocks.configRepository.getBool.mockResolvedValue(false);
        mocks.configRepository.setBool.mockResolvedValue(undefined);

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
        globalThis.window.platform.quitApplication = vi.fn();
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

    test('treats a newer release without assets as the latest version', async () => {
        const store = useVRCXUpdaterStore();
        globalThis.webApiService.execute.mockResolvedValue({
            status: 200,
            data: JSON.stringify([
                {
                    name: 'VRCX-Pro 2026.3.0',
                    tag_name: 'v2026.3.0',
                    body: 'Empty build without assets',
                    assets: []
                },
                {
                    name: 'VRCX-Pro 2026.2.0',
                    tag_name: 'v2026.2.0',
                    body: 'Previous release with assets',
                    assets: [
                        {
                            state: 'uploaded',
                            name: 'VRCX-Pro.exe',
                            content_type: 'application/x-msdownload',
                            browser_download_url:
                                'https://github.com/Yusurmount/VRCX-Pro/releases/download/v2026.2.0/VRCX-Pro.exe',
                            digest: 'sha256:abcdef',
                            size: 1234
                        }
                    ]
                }
            ])
        });

        await store.showChangeLogDialog({ prefetch: true });

        expect(store.latestAppVersion).toBe('v2026.3.0');
        expect(store.pendingVRCXUpdate).toBe(true);
    });

    test('clears the pending flag when no eligible release is published', async () => {
        const store = useVRCXUpdaterStore();
        store.pendingVRCXUpdate = true;
        store.latestAppVersion = 'v2026.2.0';
        globalThis.webApiService.execute.mockResolvedValue({
            status: 200,
            data: JSON.stringify([])
        });

        await store.showChangeLogDialog({ prefetch: true });

        expect(store.VRCXUpdateDialog.release).toBe('');
        expect(store.latestAppVersion).toBe('');
        expect(store.pendingVRCXUpdate).toBe(false);
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

    test('prompts a release update when the current build is the same-version it build', async () => {
        const store = useVRCXUpdaterStore();
        store.appVersion = 'VRCX-Pro 2026.2.0-it';
        globalThis.webApiService.execute.mockResolvedValue({
            status: 200,
            data: JSON.stringify([
                {
                    name: 'VRCX-Pro 2026.2.0',
                    tag_name: 'v2026.2.0',
                    body: 'Same version, release channel',
                    assets: []
                }
            ])
        });

        await store.showChangeLogDialog({ prefetch: true });

        expect(store.VRCXUpdateDialog.release).toBe('v2026.2.0');
        expect(store.pendingVRCXUpdate).toBe(true);
    });

    test('keeps beta builds gated until beta testing is accepted', async () => {
        const store = useVRCXUpdaterStore();
        globalThis.webApiService.execute.mockResolvedValue({
            status: 200,
            data: JSON.stringify([
                {
                    prerelease: true,
                    name: 'VRCX-Pro 2026.3.0-beta',
                    tag_name: 'v2026.3.0-beta',
                    body: 'Beta build',
                    assets: []
                },
                {
                    name: 'VRCX-Pro 2026.2.0',
                    tag_name: 'v2026.2.0',
                    body: 'Release build',
                    assets: []
                }
            ])
        });

        await store.showChangeLogDialog({ prefetch: true });
        expect(store.VRCXUpdateDialog.release).toBe('v2026.2.0');

        await store.setAcceptBeta(true);

        expect(store.acceptBeta).toBe(true);
        expect(mocks.configRepository.setBool).toHaveBeenCalledWith(
            'VRCX_acceptBeta',
            true
        );
        expect(store.VRCXUpdateDialog.release).toBe('v2026.3.0-beta');
    });

    test('prefers the release channel when the same version ships it/beta builds', async () => {
        const store = useVRCXUpdaterStore();
        globalThis.webApiService.execute.mockResolvedValue({
            status: 200,
            data: JSON.stringify([
                {
                    prerelease: true,
                    name: 'VRCX-Pro 2026.2.0-it',
                    tag_name: 'v2026.2.0-it',
                    body: 'it build',
                    assets: []
                },
                {
                    prerelease: true,
                    name: 'VRCX-Pro 2026.2.0-beta',
                    tag_name: 'v2026.2.0-beta',
                    body: 'beta build',
                    assets: []
                },
                {
                    name: 'VRCX-Pro 2026.2.0',
                    tag_name: 'v2026.2.0',
                    body: 'release build',
                    assets: []
                }
            ])
        });

        await store.setAcceptBeta(true);

        expect(store.VRCXUpdateDialog.release).toBe('v2026.2.0');
    });

    test('only enables install after the backend confirms a complete download', async () => {
        const store = useVRCXUpdaterStore();
        const release = {
            name: 'VRCX-Pro 2026.2.0',
            tag_name: 'v2026.2.0',
            assets: [
                {
                    state: 'uploaded',
                    name: 'VRCX-Pro.exe',
                    content_type: 'application/x-msdownload',
                    browser_download_url:
                        'https://github.com/Yusurmount/VRCX-Pro/releases/download/v2026.2.0/VRCX-Pro.exe',
                    digest: 'sha256:abcdef',
                    size: 1234
                }
            ]
        };
        store.VRCXUpdateDialog.releases = [release];
        store.VRCXUpdateDialog.release = release.tag_name;
        globalThis.AppApi.DownloadUpdate = vi.fn().mockResolvedValue(true);
        globalThis.AppApi.GetUpdateStatus = vi
            .fn()
            .mockResolvedValueOnce({
                state: 'downloading',
                progress: 42,
                error: ''
            })
            .mockResolvedValueOnce({
                state: 'complete',
                progress: 100,
                error: ''
            });

        const download = store.downloadSelectedVRCXUpdate();
        await flushPromises();

        expect(store.updateInProgress).toBe(true);
        expect(store.pendingVRCXInstall).toBe('');
        expect(store.VRCXUpdateDialog.updatePending).toBe(false);

        await new Promise((resolve) => setTimeout(resolve, 300));
        await download;

        expect(store.updateInProgress).toBe(false);
        expect(store.pendingVRCXInstall).toBe(release.tag_name);
        expect(store.VRCXUpdateDialog.updatePending).toBe(true);
    });

    test('reports backend download errors and keeps install hidden', async () => {
        const store = useVRCXUpdaterStore();
        const release = {
            name: 'VRCX-Pro 2026.2.0',
            tag_name: 'v2026.2.0',
            assets: [
                {
                    state: 'uploaded',
                    name: 'VRCX-Pro.exe',
                    content_type: 'application/x-msdownload',
                    browser_download_url:
                        'https://github.com/Yusurmount/VRCX-Pro/releases/download/v2026.2.0/VRCX-Pro.exe',
                    digest: 'sha256:abcdef',
                    size: 1234
                }
            ]
        };
        store.VRCXUpdateDialog.releases = [release];
        store.VRCXUpdateDialog.release = release.tag_name;
        globalThis.AppApi.DownloadUpdate = vi.fn().mockResolvedValue(true);
        globalThis.AppApi.GetUpdateStatus = vi.fn().mockResolvedValue({
            state: 'error',
            progress: 0,
            error: 'HTTP 403'
        });

        await store.downloadSelectedVRCXUpdate();

        expect(store.updateError).toContain('HTTP 403');
        expect(store.pendingVRCXInstall).toBe('');
        expect(store.VRCXUpdateDialog.updatePending).toBe(false);
        expect(store.updateInProgress).toBe(false);
        expect(mocks.toast.error).toHaveBeenCalledOnce();
    });

    test('routes release downloads through the selected GitHub mirror', async () => {
        const store = useVRCXUpdaterStore();
        const release = {
            name: 'VRCX-Pro 2026.2.0',
            tag_name: 'v2026.2.0',
            assets: [
                {
                    state: 'uploaded',
                    name: 'VRCX-Pro.exe',
                    content_type: 'application/x-msdownload',
                    browser_download_url:
                        'https://github.com/Yusurmount/VRCX-Pro/releases/download/v2026.2.0/VRCX-Pro.exe',
                    digest: 'sha256:abcdef',
                    size: 1234
                }
            ]
        };
        store.VRCXUpdateDialog.releases = [release];
        store.VRCXUpdateDialog.release = release.tag_name;
        globalThis.webApiService.execute.mockResolvedValue({
            status: 200,
            data: JSON.stringify([release])
        });
        globalThis.AppApi.DownloadUpdate = vi.fn().mockResolvedValue(true);
        globalThis.AppApi.GetUpdateStatus = vi.fn().mockResolvedValue({
            state: 'complete',
            progress: 100,
            error: ''
        });

        await store.downloadSelectedVRCXUpdate();
        expect(globalThis.AppApi.DownloadUpdate).toHaveBeenCalledWith(
            release.assets[0].browser_download_url,
            'abcdef',
            1234
        );

        await store.setUpdateRoute('mirror');
        expect(mocks.configRepository.setString).toHaveBeenCalledWith(
            'VRCX_updateRoute',
            'mirror'
        );
        // Switching routes re-runs the check through the chosen route.
        expect(globalThis.webApiService.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'https://gh-proxy.org/https://api.github.com/repos/Yusurmount/VRCX-Pro/releases'
            })
        );

        await store.downloadSelectedVRCXUpdate();
        expect(globalThis.AppApi.DownloadUpdate).toHaveBeenLastCalledWith(
            `https://gh-proxy.org/${release.assets[0].browser_download_url}`,
            'abcdef',
            1234
        );

        await store.setUpdateRoute('official');
        expect(globalThis.webApiService.execute).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: 'https://api.github.com/repos/Yusurmount/VRCX-Pro/releases'
            })
        );
    });

    test('does not quit when the installer cannot be started', async () => {
        const store = useVRCXUpdaterStore();
        globalThis.AppApi.RestartApplication = vi.fn().mockResolvedValue(false);

        await store.restartVRCX(true);

        expect(
            globalThis.window.platform.quitApplication
        ).not.toHaveBeenCalled();
        expect(store.updateError).toContain(
            'message.vrcx_updater.install_start_failed'
        );
        expect(mocks.toast.error).toHaveBeenCalledOnce();
    });

    test('relaunches the app without the installer when not upgrading', async () => {
        const store = useVRCXUpdaterStore();
        globalThis.AppApi.RestartApplication = vi.fn().mockResolvedValue(true);
        globalThis.window.platform.restartApp = vi
            .fn()
            .mockResolvedValue(undefined);

        await store.restartVRCX(false);

        expect(globalThis.AppApi.RestartApplication).not.toHaveBeenCalled();
        expect(globalThis.window.platform.restartApp).toHaveBeenCalledOnce();
        expect(store.updateError).toBe('');
        expect(mocks.toast.error).not.toHaveBeenCalled();
    });
});
