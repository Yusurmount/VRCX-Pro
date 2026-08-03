// @ts-nocheck
import TauriInteropApi from '../ipc-tauri/interopApi.js';
import { electron as tauriElectron } from '../ipc-tauri/electron.js';
import configRepository from '../services/config.js';
import vrcxJsonStorage from '../services/jsonStorage.js';

function isTauri() {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Tauri 环境：绑定到 Tauri invoke 适配层（Rust 转发给 C# sidecar）。
 * Electron / Cef 运行路径已随旧框架移除。
 */
export async function initInteropApi(isVrOverlay = false) {
    if (!isTauri()) {
        console.warn(
            'VRCX-Pro now requires the Tauri runtime (window.__TAURI_INTERNALS__ missing).'
        );
        return;
    }

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
}
