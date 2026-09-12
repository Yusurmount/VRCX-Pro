import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { relaunch } from '@tauri-apps/plugin-process';

const call = (command, args) => invoke(command, args).catch(() => null);
const sidecarCall = (ready, className, methodName, args) =>
    ready.then(() =>
        invoke('dotnet_call', {
            id: Date.now(),
            className,
            methodName,
            args
        }).then((response) => response?.result ?? response)
    );

export function installRuntimeBridge() {
    if (window.platform) return;

    const ready = call('start_dotnet_sidecar');

    window.platform = {
        ready,
        getArch: () => call('get_arch'),
        getNoUpdater: () => false,
        getClipboardText: () => readText(),
        setTrayIconNotification: (notify) => call('set_tray_icon_notification', { notify }),
        openFileDialog: () => open({ directory: false, multiple: false }),
        openJsonFileDialog: () =>
            open({ directory: false, multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] }),
        openDirectoryDialog: () => open({ directory: true, multiple: false }),
        saveFileDialog: (defaultName, formatLabel) =>
            save({ defaultPath: defaultName, filters: formatLabel ? [{ name: formatLabel, extensions: ['json'] }] : undefined }),
        writeFile: (filePath, buffer) =>
            call('write_file', { filePath, bytes: Array.from(new Uint8Array(buffer)) }),
        readFile: (filePath) => call('read_file', { filePath }),
        machineEncrypt: (plaintext) => sidecarCall(ready, 'AppApi', 'MachineEncrypt', [plaintext]),
        machineDecrypt: (encryptedData) => sidecarCall(ready, 'AppApi', 'MachineDecrypt', [encryptedData]),
        desktopNotification: (title, body, image) => {
            const options = { title, body };
            if (image) {
                options.icon = image;
            }
            return invoke('plugin:notification|notify', { options }).catch(
                (error) => {
                    console.error('desktopNotification failed', error);
                }
            );
        },
        restartApp: () => relaunch(),
        quitApplication: () => call('quit_application'),
        showMainWindow: () => call('show_main_window'),
        setCloseToTray: (enabled) => call('set_close_to_tray', { enabled }),
        getOverlayWindow: () => call('get_overlay_window'),
        updateVr: (active, hmdOverlay, wristOverlay, menuButton, overlayHand) =>
            call('update_vr', { active, hmdOverlay, wristOverlay, menuButton, overlayHand }),
        onWindowPositionChanged: () => () => {},
        onWindowSizeChanged: () => () => {},
        onWindowStateChange: () => () => {},
        onBrowserFocus: () => () => {},
        ipcRenderer: { on: () => undefined }
    };
}
