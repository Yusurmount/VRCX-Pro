---
feature: small-window-auto-zoom
status: delivered
updated: 2026-10-01
branch: feat/small-window-auto-zoom
commits: fd7b22dd..cee5b108
---

# Small Window Auto Zoom（小窗口自动降低 DPI）

## Report

**What was built** — 主窗口最小尺寸从 960×600 降到 800×600（`tauri.conf.json`）。新增 `set_window_zoom` Tauri 命令（`WebviewWindow::set_zoom`），并在 `runtime.js` 暴露 `setWindowZoom` / `getWindowInnerSize` / `onWindowInnerResize` 三个桥方法。新缩放服务 `windowZoom.js` 持有手动缩放基准（`VRCX_ZoomLevel` 持久化，percent 与 Electron zoomLevel 双单位换算），按窗口逻辑内宽计算生效缩放：<880 → min(手动,85%)、880–959 → min(手动,90%)、≥960 → 手动值；启动时应用、窗口尺寸变化时重算、比值未变则跳过重复调用。`AppApi.SetZoom/GetZoom` 经 Proxy 接线到该服务，设置页与状态栏缩放控件从空桩变为真实生效，其余 AppApi 方法原样透传 .NET sidecar。

**Verification** — `npx vitest run src/services/__tests__/windowZoom.test.js src/plugins/__tests__/interopApi.test.js` → 16/16 PASS；`npm test`（全量）→ 37 failed files / 153 failed tests，与基线 fd7b22dd 完全一致（PRE-EXISTING，本改动 +2 文件/+16 通过用例、0 新增失败）；`npm run lint:oxlint` → 71 warnings/38 errors，与基线一致（PRE-EXISTING；改动文件 oxlint+eslint 均 0 findings）；`npm run typecheck:js` → 基线即不可用（typescript 不在依赖中，根目录同样失败）；`cargo check`（src-tauri，共享 CARGO_TARGET_DIR）→ PASS；`npm run verify:tauri` → PASS；`npx oxfmt --check` 改动文件 → PASS（`runtime.js` 基线即 oxfmt-dirty，其 diff 仅含新增行）。独立评审（general-1）：Spec compliance / Correctness / Codebase consistency 三项 PASS，0 CRITICAL；两个 minor 竞态（启动窗口期 GetZoom 默认值、连续 resize 重叠）接受不改，Proxy 转发测试缺口已补 `interopApi.test.js` 关闭。

**Journey log** —

1. `npm ci` 在基线即失败（package-lock 与 package.json 不同步）→ 改用 junction 复用根目录 node_modules，未动 lockfile。
2. `Manager::get_webview` 被 `unstable` 特性门控，`cargo check` 报 E0599 → 改用稳定的 `WebviewWindow::set_zoom`（同一底层 ZoomFactor API）。
3. 对 `runtime.js` 跑 oxfmt 时把基线未格式化的无关行一并重排 → 回滚该文件后只重放本改动的新增行，保持 diff surgical；教训：format:check 基线失败的文件不能整文件 format。
4. worktree 缺 `build/TauriBackend` 导致 tauri build script 失败 → junction 根目录 `build/` 解决。
5. 全量 `npm test`/lint 在基线就有大量失败（153 测试、38 oxlint errors、75 eslint errors）→ 均记为 PRE-EXISTING，靠与基线对比 + 改动文件零 findings 证明无回归；`typecheck:js` 因依赖缺失整条不可用。

## [S1] Problem

主窗口最小尺寸被固定为 960×600（`src-tauri/tauri.conf.json`），窗口无法进一步收窄，不便分屏或在小尺寸笔记本上使用。用户要求：把最小窗口尺寸降到 800×600，并在窗口宽度低于阈值时自动降低整体 DPI（缩放），使内容在小窗口下保持可读、布局不被挤压。

现有设置页（InterfaceTab）与状态栏（StatusBar）已有缩放控件，走 `AppApi.SetZoom/GetZoom`；但 .NET 后端是空桩（`Program.cs` 中 `getzoom` 恒返 `1d`、`setzoom` 恒返 `true`），缩放实际不生效。

## [S2] Design

### 窗口配置

- `src-tauri/tauri.conf.json`：`minWidth` 960 → 800；`minHeight` 保持 600；默认尺寸 1280×800 不变。

### Rust 层

- 新增 Tauri 命令 `set_window_zoom(app, zoom: f64) -> Result<bool, String>`（`src-tauri/src/lib.rs`）：通过 `app.get_webview_window("main")` 调用 tauri 2 稳定 API `WebviewWindow::set_zoom(zoom)`（Windows WebView2 上映射为 ZoomFactor；`Manager::get_webview` 需要 `unstable` 特性，故未采用）；失败时返回 `Err` 字符串。注册进 `invoke_handler`。
- Rust 侧无状态，不提供 get：当前生效缩放值由前端持有。

### 前端平台桥

- `src/platform/runtime.js` 新增三个方法（原生 Tauri API 只允许出现在该层）：
  - `setWindowZoom(zoom)` → `call('set_window_zoom', { zoom })`，参数为比例值（`0.9` = 90%），沿用现有 `call()` 的 catch→null 语义。
  - `getWindowInnerSize()` → 逻辑内尺寸 `{ width, height }` = `innerSize()` 物理值 ÷ `scaleFactor()`（OS 级，不受页面 zoom 影响；禁止 `devicePixelRatio`，它随 zoom 变化会形成回环），失败返回 null。
  - `onWindowInnerResize(handler)` → 订阅 Tauri `onResized`，每次换算逻辑尺寸后回调，返回可调用的退订函数。

### 缩放服务（新文件 `src/services/windowZoom.js`）

职责：持有手动缩放基准值、按窗口逻辑宽度计算生效缩放、调用 `platform.setWindowZoom` 应用。

- **单位约定**：内部与 UI 使用百分比整数（`100` = 100%）；`AppApi` 接口使用 Electron zoomLevel 单位，换算 `level = percent/10 - 10`、`percent = (level+10)*10`（与 InterfaceTab / StatusBar 现有换算公式一致）。
- **手动基准值持久化**：`VRCXStorage` key `VRCX_ZoomLevel`（百分比整数字符串），默认 `100`。
- **生效缩放**（纯函数 `resolveEffectiveZoom(manualPercent, logicalWidth)`）：
  - `logicalWidth >= 960` → `manualPercent`
  - `880 <= logicalWidth < 960` → `min(manualPercent, 90)`
  - `logicalWidth < 880` → `min(manualPercent, 85)`
  - `min` 保证手动值本身低于档位时，窗口变小不会反而放大。
- **逻辑宽度来源**：经平台桥 `window.platform.getWindowInnerSize()`（初始尺寸）与 `window.platform.onWindowInnerResize()`（尺寸变化）获取逻辑内尺寸；服务本身不直接 import `@tauri-apps/api`，也不使用 `outerSize()`（阈值与 `minWidth` 一致按内尺寸判定）。
- **应用时机**：`init`（读手动值 + 初始尺寸 + 立即 apply）、`onResized`（重算 + apply）、`setManualZoom`（写存储 + 重算 + apply）。
- **初始化位置**：`src/app.js` 中 `await initInteropApi()` 之后调用 `initWindowZoom()`（VRCXStorage 已就绪）；init 失败仅 `console.error`，不阻断启动。

### AppApi 接线

- `src/plugins/interopApi.js`：`window.AppApi` 外包一层 Proxy——`SetZoom(level)` 转调缩放服务 `setManualZoom(level)`；`GetZoom()` 返回当前手动值（level 单位）；其余属性原样透传原有 InteropApi 代理。
- `InterfaceTab.vue`、`StatusBar.vue` 调用方不改动。
- .NET `Program.cs` 的 `getzoom`/`setzoom` 空桩不改动（主窗口缩放路径不再经过它）。

### 错误行为

- `set_window_zoom` 调用失败：`runtime.js` 的 `call()` 已 catch 并返回 null，静默忽略，不重试。
- 存储读写失败：回落默认 100%。

### 测试边界

- 纯函数 `resolveEffectiveZoom` 的档位与 `min` 行为（含 960 / 880 边界）。
- level ↔ percent 换算往返。
- 服务对 `platform.setWindowZoom` 的调用（mock `window.platform` 与存储）。
- AppApi Proxy 的 `SetZoom` / `GetZoom` 转发与其他方法透传（`src/plugins/__tests__/interopApi.test.js`）。

## [S3] Out of Scope

- 各视图在 800 宽下的逐页布局修复 / 响应式改造（本次以整体缩放替代）。
- 阈值与档位的用户可配置化、新增设置项或文案（无 i18n 变更）。
- .NET 后端 zoom 空桩清理；VR overlay；Linux/macOS 现有 UI 门控调整。
- WebView2 原生快捷键缩放（Ctrl+滚轮等）的接管或禁用。
- 窗口位置恢复、默认尺寸、`resize_window` 行为。

## Tasks

- [x] T1: `tauri.conf.json` minWidth 960→800 — acceptance: 配置为 800×600，`npm run verify:tauri` 通过 (covers: S2)
- [x] T2: Rust `set_window_zoom` 命令并注册 invoke_handler — acceptance: `cargo check` 通过且命令出现在 `generate_handler!` (covers: S2)
- [x] T3: `runtime.js` 增加 `setWindowZoom` 桥 — acceptance: 改动文件 lint 通过（`typecheck:js` 基线不可用：typescript 不在依赖中），模式与相邻桥方法一致 (covers: S2; depends: T2)
- [x] T4: `windowZoom` 服务（纯函数 + 持久化 + resize 监听 + apply）并在 `app.js` 初始化 — acceptance: vitest 覆盖档位/换算/apply 调用并通过 (covers: S2; depends: T3)
- [x] T5: AppApi `SetZoom`/`GetZoom` 接线到缩放服务 — acceptance: 与设置页/状态栏换算往返一致，`windowZoom` 14 项与 `interopApi` 2 项测试通过 (covers: S2; depends: T4)
