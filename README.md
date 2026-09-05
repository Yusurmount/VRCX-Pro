<div align="center">

# VRCX-Pro

**VRChat 更好的好友关系管理工具的社区增强分支**

基于 [VRCX](https://github.com/vrcx-team/VRCX) 与 [VRCX-jirai](https://github.com/FuLuTang/VRCX-jirai)，非官方版本，
使用 **Tauri 2 + Vue 3** 构建桌面端。

</div>

---

## 简介

VRCX-Pro 在完全保留上游 [VRCX](https://github.com/vrcx-team/VRCX) 基础体验的前提下，增加少量增强层，
为动捕玩家、世界/头像创作者及重度用户提供实用增强，**始终优先保证稳定性与 API 合规**。

> **叠甲**
>
> - 软件功能仅供娱乐，禁止用于非法用途！
> - 所有功能均基于 VRCX 原版数据库与原版接口 API，没有实现任何"不应获取到的信息"。
> - 所有抓取到的信息均为**公开**信息，不存在任何盗取隐私的行为。

## 核心功能

- 好友关系管理、上下线状态追踪、收藏管理与分组
- 本地日志解析、备注与标签（由上游提供）
- WebSocket 实时通知、垃圾好友请求自动拒绝
- 画廊打印收藏、群组管理与日历导出、外部链接确认
- 批量解除审核、实例操作队列提示等实用增强

## 与上游的差异

VRCX-Pro 绝大多数基础能力与上游 VRCX 一致，仅在增强层上扩展：

> 所有本地数据（收藏分组、备注、标签、在线记录等）仅存储于本地 SQLite，不上传任何第三方服务器。

## 技术栈

- **桌面外壳**：Tauri 2（替代 Electron / CEF，见 [Tauri 迁移说明](TAURI_MIGRATION.md)）
- **前端**：Vue 3 + Vite + Pinia + Tailwind CSS + GSAP
- **后端 sidecar**：.NET (TauriBackend)，负责 `dotnet_call` 请求（存储、SQLite、AppApi、更新等）
- **运行环境**：Node.js ≥ 24.10.0，npm ≥ 11.5.0

## 从源码构建

```bash
# 前端依赖安装与构建
npm install
npm run prod              # 前端生产构建（含第三方许可生成）

# Tauri 后端构建
npm run build:tauri-backend

# 完整 Tauri 打包（installer / portable）
build-scripts/build-install-package.cmd
build-scripts/build-portable-package.cmd

# 本地开发
npm run tauri:dev
```

### 前端校验

```bash
npm run lint
npm run typecheck:js
npm test
```

### 打包前

运行 `npm run verify:tauri` 确认旧的桌面运行时（Electron / CEF）未回归。

> 需要先安装 Rust 及平台所需 WebView 前置依赖。
> 其他细节请参考上游 [Building from source](https://github.com/vrcx-team/VRCX/wiki/Building-from-source)。

## 风险提示

- **API 限流**：VRChat API 触发 429 后会自动降速。可在 **设置 → 高级 → VRChat API 请求间隔下限保护** 调整等待秒数（默认 60s，硬性下限 30s），请勿将间隔配置得过小，以免触发风控。
- **非官方声明**：VRCX-Pro 是社区增强分支，**非 VRChat 官方产品**，与 VRChat Inc. 无隶属关系。VRChat 及其相关商标归 VRChat Inc. 所有。
- **禁止用途**：本项目不包含也不支持批量用户抓取、自动刷、自动加好友、绕过官方限制等违规功能。

---

## MIT License

本项目基于 **MIT License** 许可协议发布。

```
MIT License

Copyright (c) 2019-2026 pypy and individual contributors. (VRCX)
Copyright (c) FuLuTang. (VRCX-jirai)
Copyright (c) Yusurmount. (VRCX-Pro)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

> VRCX-Pro by Yusurmount is not endorsed by VRChat and does not reflect the views or opinions of VRChat or anyone officially involved in producing or managing VRChat properties. VRChat and all associated properties are trademarks or registered trademarks of VRChat Inc. VRChat © VRChat Inc.
