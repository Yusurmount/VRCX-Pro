// @ts-nocheck
import InteropApi from '../ipc-electron/interopApi.js';
import TauriInteropApi from '../ipc-tauri/interopApi.js';
import { electron as tauriElectron } from '../ipc-tauri/electron.js';
import configRepository from '../services/config.js';
import vrcxJsonStorage from '../services/jsonStorage.js';

function isTauri() {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function initInteropApi(isVrOverlay = false) {
    const hasCefSharp = typeof CefSharp !== 'undefined';

    // Tauri 环境：绑定到 Tauri invoke 适配层（Rust 转发给 C# sidecar）
    if (isTauri()) {
        window.electron = tauriElectron;
        if (isVrOverlay) {
            // @ts-ignore
            window.AppApiVr = TauriInteropApi.AppApiVrElectron;
        } else {
            window.AppApi = TauriInteropApi.AppApiElectron;
            window.WebApi = TauriInteropApi.WebApi;
            window.VRCXStorage = TauriInteropApi.VRCXStorage;
            window.SQLite = TauriInteropApi.SQLite;
            window.LogWatcher = TauriInteropApi.LogWatcher;
            window.Discord = TauriInteropApi.Discord;
            window.AssetBundleManager = TauriInteropApi.AssetBundleManager;
            window.AppApiVrElectron = TauriInteropApi.AppApiVrElectron;

            await configRepository.init();
            new vrcxJsonStorage(VRCXStorage);

            AppApi.SetUserAgent();
        }
        return;
    }

    if (isVrOverlay) {
        if (hasCefSharp) {
            await CefSharp.BindObjectAsync('AppApiVr');
        } else {
            // @ts-ignore
            window.AppApiVr = InteropApi.AppApiVrElectron;
        }
    } else {
        // #region | Init Cef C# bindings
        if (hasCefSharp) {
            await CefSharp.BindObjectAsync(
                'AppApi',
                'WebApi',
                'VRCXStorage',
                'SQLite',
                'LogWatcher',
                'Discord',
                'AssetBundleManager'
            );
        } else {
            window.AppApi = InteropApi.AppApiElectron;
            window.WebApi = InteropApi.WebApi;
            window.VRCXStorage = InteropApi.VRCXStorage;
            window.SQLite = InteropApi.SQLite;
            window.LogWatcher = InteropApi.LogWatcher;
            window.Discord = InteropApi.Discord;
            window.AssetBundleManager = InteropApi.AssetBundleManager;
            window.AppApiVrElectron = InteropApi.AppApiVrElectron;
        }

        await configRepository.init();
        new vrcxJsonStorage(VRCXStorage);

        AppApi.SetUserAgent();
    }
}
