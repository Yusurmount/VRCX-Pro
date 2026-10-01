// @ts-nocheck
import InteropApi from '../ipc/interopApi.js';
import configRepository from '../services/config.js';
import vrcxJsonStorage from '../services/jsonStorage.js';
import { windowZoomApi } from '../services/windowZoom.js';

export async function initInteropApi(isVrOverlay = false) {
    if (isVrOverlay) {
        window.AppApiVr = InteropApi.AppApiVr;
    } else {
        // Zoom is handled in-process by the window zoom service; everything
        // else still proxies through the .NET sidecar.
        window.AppApi = new Proxy(InteropApi.AppApi, {
            get(target, property) {
                if (Object.hasOwn(windowZoomApi, property)) {
                    return windowZoomApi[property];
                }
                return Reflect.get(target, property);
            }
        });
        window.WebApi = InteropApi.WebApi;
        window.VRCXStorage = InteropApi.VRCXStorage;
        window.SQLite = InteropApi.SQLite;
        window.LogWatcher = InteropApi.LogWatcher;
        window.Discord = InteropApi.Discord;
        window.AssetBundleManager = InteropApi.AssetBundleManager;

        await configRepository.init();
        new vrcxJsonStorage(VRCXStorage);

        AppApi.SetUserAgent();
    }
}
