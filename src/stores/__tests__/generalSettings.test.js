import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
    configRepository: {
        getBool: vi.fn(),
        getString: vi.fn(),
        getInt: vi.fn(),
        setBool: vi.fn(),
        remove: vi.fn()
    },
    friendStore: {
        updateLocalFavoriteFriends: vi.fn()
    },
    modalStore: {
        prompt: vi.fn()
    },
    updaterStore: {},
    vrcxStore: {}
}));

vi.mock('../../services/config', () => ({
    default: mocks.configRepository
}));

vi.mock('../friend', () => ({
    useFriendStore: () => mocks.friendStore
}));

vi.mock('../modal', () => ({
    useModalStore: () => mocks.modalStore
}));

vi.mock('../vrcxUpdater', () => ({
    useVRCXUpdaterStore: () => mocks.updaterStore
}));

vi.mock('../vrcx', () => ({
    useVrcxStore: () => mocks.vrcxStore
}));

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key) => key
    })
}));

import { useGeneralSettingsStore } from '../settings/general';

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

let startupEnabled;

async function createStore() {
    setActivePinia(createPinia());
    const store = useGeneralSettingsStore();
    await flushPromises();
    return store;
}

describe('general settings Windows startup', () => {
    beforeEach(() => {
        startupEnabled = false;

        mocks.configRepository.getBool.mockImplementation((key, defaultValue) =>
            Promise.resolve(
                key === 'VRCX_StartAtWindowsStartup'
                    ? startupEnabled
                    : defaultValue
            )
        );
        mocks.configRepository.getString.mockImplementation(
            (_key, defaultValue) => Promise.resolve(defaultValue)
        );
        mocks.configRepository.getInt.mockImplementation((_key, defaultValue) =>
            Promise.resolve(defaultValue)
        );
        mocks.configRepository.setBool.mockResolvedValue(undefined);
        mocks.configRepository.remove.mockResolvedValue(undefined);

        globalThis.AppApi = {
            SetStartup: vi.fn().mockResolvedValue(true)
        };
        globalThis.window.platform.setCloseToTray = vi.fn();
    });

    test('reconciles Windows startup registration from saved config on init', async () => {
        startupEnabled = true;

        await createStore();

        expect(globalThis.AppApi.SetStartup).toHaveBeenCalledWith(true);
    });

    test('persists and registers startup when the switch is enabled', async () => {
        const store = await createStore();
        vi.clearAllMocks();

        await store.setIsStartAtWindowsStartup();

        expect(store.isStartAtWindowsStartup).toBe(true);
        expect(mocks.configRepository.setBool).toHaveBeenLastCalledWith(
            'VRCX_StartAtWindowsStartup',
            true
        );
        expect(globalThis.AppApi.SetStartup).toHaveBeenCalledWith(true);
    });

    test('rolls back config and switch when Windows registration fails', async () => {
        startupEnabled = true;
        const store = await createStore();
        vi.clearAllMocks();
        globalThis.AppApi.SetStartup.mockResolvedValue(false);
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await store.setIsStartAtWindowsStartup();

        expect(store.isStartAtWindowsStartup).toBe(true);
        expect(mocks.configRepository.setBool).toHaveBeenLastCalledWith(
            'VRCX_StartAtWindowsStartup',
            true
        );
        expect(globalThis.AppApi.SetStartup).toHaveBeenCalledWith(false);
        expect(consoleError).toHaveBeenCalled();

        consoleError.mockRestore();
    });
});
