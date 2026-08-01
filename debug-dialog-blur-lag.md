# Debug Session: dialog-blur-lag

- **Status**: [OPEN]
- **Session ID**: `dialog-blur-lag`
- **Created**: 2026-08-01

## 问题描述 (Problem)

程序在涉及到弹窗（对话框，带背景模糊 `backdrop-filter`）时会变得卡顿。

- **实际行为**: 打开带背景模糊的弹窗后，界面交互（滚动、动画、点击响应）明显卡顿
- **期望行为**: 弹窗打开/关闭以及弹窗打开期间，界面保持流畅（60fps）

## 相关代码

- 弹窗遮罩: `src/components/ui/dialog/DialogOverlay.vue` — 应用了 Tailwind `backdrop-blur-xs`（即 `backdrop-filter: blur(4px)`），除非 `disableGpuAcceleration` 设置为 true
- 全屏图片预览遮罩: `src/components/FullscreenImagePreview.vue` — 应用了 `backdrop-blur-sm`
- Electron 主进程: `src-electron/main.js:19` — **无条件**调用 `app.disableHardwareAcceleration()`（上游代码，commit a2dc6ba9，不能删除）
- 渲染进程设置: `src/stores/settings/general.js` — `disableGpuAcceleration`（仅控制渲染层 blur 是否启用）

## 复现步骤 (Reproduction)

1. 启动应用（`npm run dev` 或 Electron 打包版）
2. 打开任意带背景模糊的弹窗（例如：点击好友 → 用户信息弹窗；Feed 帖子 → 详情弹窗；全屏图片预览）
3. 观察弹窗打开期间界面的流畅度（滚动/悬停/动画）
4. 关闭弹窗，对比流畅度

## 假设 (Hypotheses)

| ID | 假设 | 可能性 | 验证成本 | 可证伪信号 |
|----|------|--------|----------|-----------|
| A | `app.disableHardwareAcceleration()` 导致 backdrop-filter 走软件渲染，全屏 blur 每帧在 CPU 上重算 → 卡顿 | High | Low | GPU 状态 `accelerated_compositing: disabled`；遮罩挂载时 FPS 掉、卸载后恢复 |
| B | 弹窗背后有持续动画/频繁重绘（动态内容、通知、滚动）→ blur 每帧重合成 | Medium | Low | 弹窗打开期间 rAF 帧间隔持续 >50ms，即使无用户交互 |
| C | 弹窗开/关动画（fade/zoom 200ms）与 blur 叠加导致卡顿，动画结束后恢复 | Medium | Low | 帧时间直方图：仅开/关瞬间掉帧，稳定期恢复 ~16ms |
| D | 高 DPI / 大窗口下 blur 纹理开销随像素数线性增长 | Medium | Medium | devicePixelRatio > 1 且窗口大时 FPS 更低 |
| E | 与 blur 无关，是弹窗内容本身（复杂 DOM/大量图片）重排导致 | Low | Low | 移除 blur class 后依然掉帧 |

## 插桩 (Instrumentation)

- [x] main.js: 主进程日志 GPU 特性状态（假设 A）— `app.whenReady()` 时上报 `app.getGPUFeatureStatus()`（需完整重启应用才会触发）
- [x] DialogOverlay.vue: 遮罩挂载/卸载生命周期 + blur 状态 + rAF FPS 采样（假设 A/B/C/D/E）

> 注：HMR 热更新导致的非预期数据（49 次 overlay mounted 同一毫秒内爆发）为 HMR 重挂载产物，需完整重启后重新采集。

## 证据 (Evidence)

**首轮（HMR 热更新产物，非刻意复现）**：
- overlay mounted: `blur: true, w:1707, h:890, dpr:1.5`（150% 缩放）
- 样例1 (910ms, 35帧): avg 25.9ms, p95 115.2ms, max 127.2ms, >50ms 帧数 6 → **严重掉帧**
- 样例2 (3658ms, 447帧): avg 8.2ms, p95 6.2ms, max 133.3ms, >50ms 帧数 9 → 整体平滑但间歇性长帧
- GPU 特性状态日志缺失（主进程未重启，main.js 改动未生效）

**第二轮（刻意复现，blur ON, dpr 1.5, 窗口 1153x890）**：
- 样例B (2707ms, 62帧): avg 42.0ms (~24fps), p95 127.3ms, max 284.8ms, >50ms 帧数 **23/62** → **弹窗打开期间持续严重掉帧**
- 样例C (2893ms, 207帧): avg 13.9ms, max **1266.6ms**, >50ms 帧数 5 → 平滑但出现 1.27s 主线程长阻塞
- **进程命令行铁证（Windows OS 级证据）**：
  - renderer: `--disable-gpu-compositing` → **软件合成**
  - gpu-process: `--use-angle=d3d11-warp-webgl` → **WARP 软件光栅化**
  - `device-scale-factor=1.5`
  - 来源: `app.disableHardwareAcceleration()` (main.js:19, 上游代码)
- **插桩 bug 已修复**: main.js 上报缺 `Content-Length` 头被服务器 400 拒绝（Node chunked 编码），已加 `Content-Length` 头修复

## 验证结论 (Findings)

| ID | 假设 | 状态 | 证据 |
|----|------|------|------|
| A | 软件渲染 + 全屏 backdrop-filter → 卡顿 | ✅ **确认（根因）** | GPU 状态: `gpu_compositing/rasterization/2d_canvas = disabled_software`；A/B: blur ON avg 109ms(~9fps)/91ms，blur OFF avg 6.4-7.7ms(~150fps)，用户确认「blur off 后卡顿消失」 |
| B | 背后动态内容重绘触发 blur 每帧重算 | ✅ 部分成立（触发因素） | blur ON 时掉帧集中在动态重绘场景（样例 29帧/3.2s），静态场景平滑(6.5ms)；无 blur 时重绘廉价 |
| C | 仅开/关动画掉帧 | ❌ 已排除 | 样例B 全程 2.7s 均 ~24fps，非仅动画期 |
| D | 高 DPI 放大成本 | ✅ 放大因素（非根因） | dpr 1.5 → 2541x1317 设备像素(1694x878 CSS)，放大软件模糊成本 |
| E | 与 blur 无关 | ❌ 已排除 | blur OFF 后恢复 ~150fps，弹窗内容本身无问题 |

**因果链**：
1. `app.disableHardwareAcceleration()` (main.js:19, 上游代码) → Chromium 全部软件渲染（GPU 状态铁证）
2. DialogOverlay 全屏 `backdrop-filter: blur(4px)`（Pro 新增样式）
3. 软件渲染下任何背景重绘（VRCX 动态内容刷新）→ 全屏 CPU 模糊 ~2.3M 设备像素/帧
4. → 弹窗打开期间持续 9-24fps 卡顿

## 修复方案 (Fix)

**方案**：仅在 GPU 合成可用时才应用 backdrop-filter（自适应），软件渲染时退回纯半透明遮罩（保留 `bg-black/40`）。
- main.js: 新增 `ipcMain.handle('app:getGpuFeatureStatus')` 返回 `app.getGPUFeatureStatus()`
- preload.js: 暴露 `window.electron.getGpuFeatureStatus`
- DialogOverlay.vue / FullscreenImagePreview.vue: `gpuCompositingEnabled = (gpu.gpu_compositing === 'enabled')`；浏览器/CEF 下 `window.electron` 不存在 → 默认 true（保持原行为）
- 保留用户设置 `disableGpuAcceleration` 手动覆盖；不动上游 main.js:19

## 验证结果 (Verification)

（待确认）
