# Tauri 全量迁移收尾计划

## Context

`tauri` 分支已将 Electron/CEF 换为 Tauri 2 壳，前端 bridge 保留 `dotnet_call` 走 C# sidecar。审计发现仍有未迁移/未对齐区域：

1. 前端 [runtime.js](file:///c:/Users/12619/Documents/GitHub/VRCX-Pro/src/platform/runtime.js#L42-L44) 声明的 `get_overlay_window`、`update_vr`、`set_tray_icon_notification` 在 [lib.rs](file:///c:/Users/12619/Documents/GitHub/VRCX-Pro/src-tauri/src/lib.rs#L124) 均未注册 → 静默返回 null。
2. C# sidecar 的 `AppApi` 全是桩（[Program.cs](file:///c:/Users/12619/Documents/GitHub/VRCX-Pro/Dotnet/TauriBackend/Program.cs#L101)），前端 updater 调用的 `DownloadUpdate/CheckUpdateProgress/CancelUpdate/RestartApplication` 未实现。
3. 未启用托盘：`tauri/tray-icon` 特性已开但没用。
4. 旧 .NET 源码目录残留未清理，且 `verify-tauri.mjs` 未覆盖它们。

用户已确认迁移范围：**VR overload=仅补 bridge 占位；Updater=手动下载+替换；清理旧源码=删除并纳入 verify:tauri；托盘=实现并打通**。

目标：顶层 4 项对齐、旧源码清除、并防止回归。

## 设计要点（需遵守的约束）

- **sidecar 为单线程按行读 stdin 循环**。任何长耗时操作（下载）必须先 `Task.Run` 到后台，主循环立即返回，否则 `CheckUpdateProgress` 轮询请求会被排队阻塞、永远拿不到进度。
- **前端代理契约**：`window.AppApi.X(...)` → `dotnet_call`(className='AppApi')。因此 updater/VR 的 AppApi 方法只能在 sidecar 内实现；Tauri 无关生命周期由 Rust 命令负责。
- `obj`, `obj1` 目录是 gitignored 构建产物（git 计数 0），不做提交改动；清理仅针对已跟踪文件。

## A. Tauri 侧 lib.rs — 注册缺失命令 + 托盘

文件：`src-tauri/src/lib.rs`

1) 新增命令并在 `invoke_handler` 注册：
   - `get_overlay_window` → 返回 `Ok(Option::<serde_json::Value>::None)`（Tauri 无独立 overlay 窗口，占位）。
   - `update_vr(active: bool, hmd_overlay: bool, wrist_overlay: bool, menu_button: bool, overlay_hand: u32)` → 记录到 `Mutex<State>`（可仅返回 `Ok(true)`）。
   - `set_tray_icon_notification(notify: bool)` → 更新托盘 tooltip/提示状态，返回 `Ok(true)`。
   - `quit_application` → 关闭所有 webview 窗口以退出（供 updater 安装完成后让出文件锁）。

2) `setup` 中创建系统托盘：
   - 用 `include_bytes!("../../images/VRCX.ico")`（`src-tauri/src/lib.rs` → `../../images`）读图标。
   - 对话框（`TrayIconBuilder`）：条目“显示”(focus `main` window)、“退出”(quit)。
   - 用 `State` 保存托盘句柄与`notify`标记，供 `set_tray_icon_notification` 读写。
   - `tauri/tray-icon` 特性已启用，无需改 Cargo features；Rust 侧托盘不需要 capability 权限（新增权限仅当 JS 直接调插件 API 时用到，本轮无需）。

## B. C# sidecar — 补齐 AppApi 桩（VR 占位 + 手动更新）

文件：`Dotnet/TauriBackend/Program.cs`

1) 新增静态字段：`volatile int UpdateProgress`、`CancellationTokenSource UpdateCts`、`string? StagedUpdaterPath`、下载锁。

2) `AppApiMethod` switch 增加：
   - `setvr(active,hmd,wrist,menu,hand)` → `true`（VR 占位无操作）。
   - `executevroverlayfunction(func,json)` → `true`（VR overlay 数据不再投递的定义明确占位）。
   - `downloadupdate(url,hash,size)` → `Task.Run` 后台：HTTP GET 流式写入 `%TEMP%\VRCX\update\<file>`，边下边按 `已下载/总size` 更新 `UpdateProgress`(0-100)，完成后 SHA-256 校验与 `hash` 比对，把路径写入 `StagedUpdaterPath`，`UpdateProgress=100`；返回 `true`。函数自身**同步立即返回**（不 await），保证主循环可继续处理 `CheckUpdateProgress`。受 `UpdateCts` 控制取消。
   - `checkupdateprogress()` → 返回当前 `UpdateProgress`（int，空闲为 0）。
   - `cancelupdate()` → `UpdateCts?.Cancel()`，复位 `UpdateProgress=0`，返回 `true`。
   - `restartapplication(isUpgrade)` →：
     - Windows：若 `StagedUpdaterPath` 存在，`Process.Start(new ProcessStartInfo{ UseShellExecute=true, FileName=StagedUpdaterPath })` 启动安装器。
     - 返回 `true`。
   - `getversion` 保持现有返回值。

3) 异步分发兼容：`SqliteMethod`/`Dispatch` 已是 `async`，`AppApiMethod` 当前是同步返回 `object?`。改为 `AppApiMethod` 返回 `Task<object?>` 或保持同步（`downloadupdate` 仅启动后台任务、立即返回 true，故可保持同步；`restartapplication` 同步启动进程）。保持同步即可，无需改动 Dispatch 签名。

（若下载的 exe 是安装器，安装流程会等待应用退出以替换文件；配合 A 的 `quit_application` 由前端在启动安装器后调用。）

## C. 前端最小接线（updater 安装退出）

文件：`src/stores/vrcxUpdater.js`，`restartVRCX(isUpgrade)` 非 Linux 分支：
- 先 `await AppApi.RestartApplication(isUpgrade)`（启动安装器）。
- 再 `window.platform.quitApplication(...)`。
新增 `source/platform/runtime.js`：
- 暴露 `quitApplication: () => call('quit_application')`。

（保持 `restartApp`/relaunch 语义不变；仅在用户主动安装更新后退出让位给安装器。）

## D. 清理旧 .NET 源码并纳入 verify:tauri

删除已跟踪旧源码（git rm）：
- `Dotnet/AppApi/Common/`（10 个文件）
- `Dotnet/Overlay/`（3 个文件）
- `Dotnet/ScreenshotMetadata/`（7 个文件）
- `Dotnet/docs/screenshotMetadata-schema.json`

保留（有依赖或被 sln 引用）：`Dotnet/libs/`（build 工具授权文档引用到），`Dotnet/DBMerger/`（仍在 sln）。

文件：`scripts/verify-tauri.mjs`
- 在 `legacyFiles`/`legacyDirectories` 检查中加入上述 4 个路径，存在即 `failures.push` 退 `exit(1)`，防止回归。
- 同步 `TAURI_MIGRATION.md` 现状说明（补齐命令已实现、托盘/手动更新说明、已清理项）供后续维护参考。

## 验证

1. `npm run build:tauri-backend` 编译 C# sidecar 无错误。
2. `npm run probe:tauri-backend`（sidecar 冒烟：VRCXStorage/SQLite/WebApi）。
3. `npm run verify:tauri`：清理后应通过（旧目录已删、无 electron 残留）。
4. 手动 `npm run tauri:dev`：
   - 托盘图标出现，菜单“显示/退出”可用；调用 `set_tray_icon_notification(true/false)` 无异常。
   - `updateVr(...)`/`getOverlayWindow` 不再抛错（返回 true/null）。
   - `AppApi.SetVR`/`ExecuteVrOverlayFunction` 返回 true。
   - Updater：`AppApi.DownloadUpdate` 返回，轮询 `CheckUpdateProgress` 从 0→100，`CancelUpdate` 可中止；`RestartApplication` 启动安装器并触发应用退出。
5. 全量单测 `npm run test` 与 `npm run lint` 通过。