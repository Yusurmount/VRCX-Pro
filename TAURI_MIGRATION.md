# Tauri migration

The `tauri` branch uses Tauri 2 as the desktop shell and keeps the existing Vue/Vite renderer.
Electron and Electron Builder are intentionally not part of this branch.

## Development

Install Rust and the platform WebView prerequisites, then run:

```sh
npm run tauri:dev
```

The frontend bridge is in `src/platform/runtime.js`. Existing UI code can continue calling
the platform facade while each operation is moved to a Tauri command. The .NET implementation
will run as a separate sidecar and answer `dotnet_call` requests; no Node.js in-process hosting
is used by the Tauri shell.

## Current boundary

`src-tauri/src/lib.rs` owns the window lifecycle, single-instance behavior, and the sidecar
lifecycle. Native dialogs, notifications, filesystem operations, and VR overlay commands are
intentionally explicit Tauri commands so they can be implemented per platform without bringing
Electron or CEF into the final package.
