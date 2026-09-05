import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { relaunch } from '@tauri-apps/plugin-process';

const call = (command, args) => invoke(command, args).catch(() => null);

export function installRuntimeBridge() {
    if (window.platform) return;

    void call('start_dotnet_sidecar');

    window.platform = {
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
        machineEncrypt: (plaintext) => call('machine_encrypt', { plaintext }),
        machineDecrypt: (encryptedData) => call('machine_decrypt', { encryptedData }),
        desktopNotification: (title, body) => sendNotification({ title, body }),
        restartApp: () => relaunch(),
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
