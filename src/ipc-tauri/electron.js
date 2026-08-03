// @ts-nocheck
/**
 * Tauri 前端适配层 - 模拟 Electron preload 暴露的 `window.electron.*` 接口。
 *
 * 所有方法通过 Tauri `electron_call` command（Rust 侧实现系统集成）完成；
 * 窗口/事件类监听通过 Tauri 事件通道实现。前端代码无需改动。
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

function toEventListener(callback) {
    return (event) => callback(event, event.payload);
}

export const electron = {
    getArch: () => invoke('electron_call', { method: 'getArch' }),
    getClipboardText: () => invoke('electron_call', { method: 'getClipboardText' }),
    getNoUpdater: () => invoke('electron_call', { method: 'getNoUpdater' }),
    setTrayIconNotification: (notify) =>
        invoke('electron_call', { method: 'setTrayIconNotification', args: [notify] }),
    openFileDialog: () => invoke('electron_call', { method: 'openFileDialog' }),
    openJsonFileDialog: () => invoke('electron_call', { method: 'openJsonFileDialog' }),
    openDirectoryDialog: () => invoke('electron_call', { method: 'openDirectoryDialog' }),
    saveFileDialog: (defaultName, formatLabel) =>
        invoke('electron_call', { method: 'saveFileDialog', args: [defaultName, formatLabel] }),
    writeFile: (filePath, buffer) =>
        invoke('electron_call', { method: 'writeFile', args: [filePath, buffer] }),
    readFile: (filePath) => invoke('electron_call', { method: 'readFile', args: [filePath] }),
    machineEncrypt: (plaintext) =>
        invoke('electron_call', { method: 'machineEncrypt', args: [plaintext] }),
    machineDecrypt: (encryptedData) =>
        invoke('electron_call', { method: 'machineDecrypt', args: [encryptedData] }),
    onWindowPositionChanged: (callback) =>
        listen('window-position-changed', toEventListener(callback)),
    onWindowSizeChanged: (callback) =>
        listen('window-size-changed', toEventListener(callback)),
    onWindowStateChange: (callback) =>
        listen('window-state-changed', toEventListener(callback)),
    onBrowserFocus: (callback) => listen('browser-focus', toEventListener(callback)),
    desktopNotification: (title, body, icon) =>
        invoke('electron_call', { method: 'desktopNotification', args: [title, body, icon] }),
    restartApp: () => invoke('electron_call', { method: 'restartApp' }),
    getOverlayWindow: () => invoke('electron_call', { method: 'getOverlayWindow' }),
    updateVr: (active, hmdOverlay, wristOverlay, menuButton, overlayHand) =>
        invoke('electron_call', {
            method: 'updateVr',
            args: [active, hmdOverlay, wristOverlay, menuButton, overlayHand]
        }),
    ipcRenderer: {
        on(channel, func) {
            if (channel === 'launch-command') {
                return listen('launch-command', (event) => func(event.payload));
            }
            return undefined;
        }
    }
};
