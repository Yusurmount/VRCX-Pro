# Tauri migration

The `tauri` branch uses Tauri 2 as the desktop shell and keeps the existing Vue/Vite renderer.
Electron and Electron Builder are intentionally not part of this branch.

## Development

Install Rust and the platform WebView prerequisites, then run:

```sh
npm run tauri:dev
```

Run `npm run verify:tauri` before packaging to ensure the old desktop runtime has not returned.

The frontend bridge is in `src/platform/runtime.js`. Existing UI code can continue calling
the platform facade while each operation is moved to a Tauri command. The .NET implementation
will run as a separate sidecar and answer `dotnet_call` requests; no Node.js in-process hosting
is used by the Tauri shell.

## Current boundary

`src-tauri/src/lib.rs` owns the window lifecycle, single-instance behavior, and the sidecar
lifecycle. Native dialogs, notifications, filesystem operations, and VR overlay commands are
explicit Tauri commands so they can be implemented per platform without bringing Electron or
CEF into the final package.

Implemented command surface:

- `get_arch`, `read_file`, `write_file`, `dotnet_status`, `start_dotnet_sidecar`, `dotnet_call`.
- VR overlay bridge placeholders: `get_overlay_window`, `update_vr` (accepted but no-op; a real
  OpenVR overlay is intentionally out of scope for the Tauri shell).
- Tray: `set_tray_icon_notification` plus a system tray icon (Show/Quit menu) created in setup.
- `quit_application` closes the app; used after a manual updater launches the installer.

The C# sidecar (`Dotnet/TauriBackend`) answers `dotnet_call` requests for `VRCXStorage`, `SQLite`,
and `AppApi`. Updating is manual download + replace: the sidecar exposes `DownloadUpdate`,
`CheckUpdateProgress`, `CancelUpdate`, and `RestartApplication` (downloads/verifies the installer
and launches it; the frontend then quits so the installer can replace files).

The legacy C# host sources (`Dotnet/AppApi/Common`, `Dotnet/Overlay`, `Dotnet/ScreenshotMetadata`)
and their schema have been removed; `verify:tauri` fails if any legacy directory or dependency
comes back.
