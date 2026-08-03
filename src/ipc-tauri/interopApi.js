// @ts-nocheck
/**
 * Tauri 前端适配层 - 模拟 Electron 版 InteropApi 的动态代理行为。
 *
 * 通过 Proxy 将任意 `window.Xxx.Yyy(...)`
 * 调用转为 `window.interopApi.callDotNetMethod('Xxx', 'Yyy', args)`（Electron IPC）。
 * 本适配层将同一契约转发到 Tauri 的 `call_dotnet` command（Rust 侧再转发给
 * C# sidecar 进程），前端代码无需任何改动。
 */
import { invoke } from '@tauri-apps/api/core';

/**
 * AppApiElectron 中需要宿主（Rust 主进程）操作窗口/系统的方法。
 * sidecar 内对应实现为空（原 Electron 架构由主进程承担），故在 Tauri 下
 * 拦截转发到 `electron_call`（Rust 侧直接实现）。
 */
const HOST_METHODS = new Set([
    'SetZoom',
    'GetZoom',
    'ShowDevTools',
    'SetStartup',
    'FocusWindow',
    'FlashWindow',
    'ChangeTheme',
    'CopyImageToClipboard',
    'OpenCalendarFile',
    'RestartApplication',
    'DesktopNotification',
    'SetTrayIconNotification'
]);

class TauriInteropApi {
    constructor() {
        return new Proxy(this, {
            get(target, prop) {
                // If the property is not a method of TauriInteropApi,
                // treat it as a .NET class name (same as Electron build).
                if (typeof prop === 'string' && !target[prop]) {
                    return new Proxy(
                        {},
                        {
                            get(_, methodName) {
                                // Return a method that calls the .NET method dynamically
                                return async (...args) => {
                                    // 宿主方法 → electron_call（Rust 侧实现）
                                    if (
                                        prop === 'AppApiElectron' &&
                                        HOST_METHODS.has(methodName)
                                    ) {
                                        return await invoke('electron_call', {
                                            method: `appApi:${methodName}`,
                                            args
                                        });
                                    }
                                    return await invoke('call_dotnet', {
                                        className: prop,
                                        methodName,
                                        args
                                    });
                                };
                            }
                        }
                    );
                }
                return target[prop];
            }
        });
    }
}

export default new TauriInteropApi();
