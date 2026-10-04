<div align="center">

# VRCX-Pro

**VRChat 好友关系管理工具的社区增强分支**

基于 [VRCX](https://github.com/vrcx-team/VRCX) 与 [VRCX-jirai](https://github.com/FuLuTang/VRCX-jirai)，非官方版本，
使用 **Tauri 2 + Vue 3** 构建桌面端，内置 **MCP Server** 支持 AI 助手集成。

</div>

---

## 简介

VRCX-Pro 在完全保留上游 [VRCX](https://github.com/vrcx-team/VRCX) 基础体验的前提下，增加增强层，
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
- 批量解除审核、实例操作队列提示
- API 限流自动降速，防止触发 VRChat 风控
- OOBE 首次启动向导，新手友好
- 系统托盘、Windows 开机自启动
- 图表趋势、关系分析与 HTML 报告导出
- 好友亲密度评分：稳健归一化模型、权重可调、好友排除、百分制/绝对评分切换
- 独立数据库管理页面（概览、表数据预览、备份 / 恢复）
- 小窗口自适应：最小窗口 800×600，窄窗口自动降低缩放
- 自定义通知规则、文字转语音与邮件通知
- **MCP Server**：内置 AI 助手数据接口，支持 Claude Desktop、Cursor、Windsurf 等客户端直接查询本地 VRCX 数据

> 文档入口见 [docs/README.md](docs/README.md)；完整架构与模块参考见 [项目知识库](docs/参考/项目知识库.md)。

## 与上游的差异

VRCX-Pro 绝大多数基础能力与上游 VRCX 一致，主要差异在于：

| 方面     | VRCX（上游）        | VRCX-Pro                 |
| -------- | ------------------- | ------------------------ |
| 桌面外壳 | Electron / CEF      | Tauri 2（Rust）          |
| 前端框架 | Vue 3（CDN）        | Vue 3 + Vite + Pinia     |
| UI 组件  | 自定义              | reka-ui + Tailwind CSS 4 |
| 数据查询 | 手动管理            | TanStack Vue Query       |
| MCP 集成 | 无                  | 内置 MCP Server（axum）  |
| 后端     | Node.js native / C# | .NET 9 Sidecar + Rust    |

> 所有本地数据（收藏分组、备注、标签、在线记录等）仅存储于本地 SQLite，不上传任何第三方服务器。

## 技术栈

- **桌面外壳**：Tauri 2（替代 Electron / CEF，见 [Tauri 迁移说明](TAURI_MIGRATION.md)）
- **前端**：Vue 3 + Vite + Pinia + Tailwind CSS 4 + GSAP + ECharts
- **UI 组件**：reka-ui + lucide-vue-next
- **数据层**：TanStack Vue Query + TanStack Vue Table
- **后端 sidecar**：.NET 9（C#），负责 `dotnet_call` 请求（存储、SQLite、AppApi、更新等）
- **MCP Server**：axum（Rust），本地 AI 助手数据接口（详见 [MCP 文档](docs/参考/MCP服务器.md)）
- **运行环境**：Node.js ≥ 24.10.0，npm ≥ 11.5.0
- **前置依赖**：Rust、WebView2（Windows）

## 从源码构建

```bash
# 安装依赖
npm install

# 本地开发
npm run tauri:dev

# 前端生产构建（含第三方许可生成）
npm run prod

# Tauri 后端构建
npm run build:tauri-backend

# 完整 Tauri 打包
build-scripts/build-install-package.cmd    # NSIS 安装包
build-scripts/build-portable-package.cmd   # 便携版
```

构建频道由根目录 `version_channel` 控制：`Release` 保持原版本，`Beta`
追加 `-beta`，`It` 追加 `-it` 并启用界面水印。

环境准备、分层变更步骤和验证矩阵见 [开发指南](docs/指南/开发指南.md)、[测试指南](docs/指南/测试指南.md) 与 [发布指南](docs/指南/发布指南.md)。

### 前端校验

```bash
npm run lint            # 代码检查（oxlint + ESLint）
npm run typecheck:js    # TypeScript 类型检查
npm test                # 单元测试（Vitest）
npm run test:coverage   # 覆盖率报告
```

### 打包前

运行 `npm run verify:tauri` 确认旧的桌面运行时（Electron / CEF）未回归。

> 需要先安装 Rust 及平台所需 WebView 前置依赖。
> 其他细节请参考上游 [Building from source](https://github.com/vrcx-team/VRCX/wiki/Building-from-source)。

## 文档

| 主题 | 文档 |
| --- | --- |
| 文档总入口与维护约定 | [docs/README.md](docs/README.md) |
| 架构、数据流与变更落点 | [架构总览](docs/参考/架构总览.md) |
| 完整模块与数据库参考 | [项目知识库](docs/参考/项目知识库.md) |
| UI 组件库与样式规范 | [UI 规范](docs/参考/UI规范.md) |
| 开发、测试与发布 | [开发指南](docs/指南/开发指南.md)、[测试指南](docs/指南/测试指南.md)、[发布指南](docs/指南/发布指南.md) |
| 故障排查与安全边界 | [故障排查](docs/运维/故障排查.md)、[安全与隐私](docs/运维/安全与隐私.md) |
| 启动参数与 MCP | [启动参数](docs/参考/启动参数.md)、[MCP Server](docs/参考/MCP服务器.md) |

## MCP Server

VRCX-Pro 内置了 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 服务器，允许 AI 助手直接查询本地 VRCX 数据。

**启用方式**：设置 → 集成 → MCP Server → 开启 Enable MCP Server

**支持的 AI 客户端**：Claude Desktop、Cursor、Windsurf 等支持 MCP Streamable HTTP 的客户端。

**提供的工具**：21 项工具覆盖好友与活动查询、收藏、游戏日志、通知、数据库探索、社交分析、世界分析、用户画像、共同位置及本地备注写入；另提供 2 项 Resource。

> 完整配置与工具列表请参阅 [MCP 文档](docs/参考/MCP服务器.md)。

## 版本历史

| 版本      | 主要变更                                                                                      |
| --------- | --------------------------------------------------------------------------------------------- |
| **3.5.1** | 数据库管理页面、亲密度评分口径切换（百分制/绝对评分）与排行优化、登录遮罩优化、小窗口自适应、启动加载优化、界面调试工具组件页补全 |
| **3.5.0** | 好友亲密度评分重设计（稳健归一化、权重可调、好友排除）、简介历史对比与差异视图、备份/恢复文案统一 |
| **3.4.2** | 修复房间更新、启动注册与个人资料更新等稳定性问题                                              |
| **3.4.1** | 优化更新检测与下载反馈、登录体验和离线可用性                                                  |
| **3.4.0** | 数据导出、分析报告、MCP 工具扩展与启动体验完善                                                |
| **3.3.0** | 群组与装扮功能、UI 调试预览、邮件通知                                                         |
| **3.2.0** | 内置 MCP Server，AI 助手集成                                                                  |
| **3.1.3** | 独立数据库管理对话框、UI 组件库展厅、调试工具重构                                             |
| **3.1.2** | 修复桌面通知                                                                                  |
| **3.1.1** | 浅色模式背景优化                                                                              |
| **3.1.0** | OOBE 向导进度、启动动画、开机自启动                                                           |
| **3.0.0** | Tauri 2 全量迁移、系统托盘、API 限流降速                                                      |
| **2.3.0** | 画廊打印收藏、自动拒绝垃圾好友、批量解除审核                                                  |

> 各版本详细更新日志请参阅 [GitHub Releases](https://github.com/Yusurmount/VRCX-Pro/releases)；本地存在时也可查看仓库根目录的 `*_CHANGELOG.md`。

## 风险提示

- **API 限流**：VRChat API 触发 429 后会自动降速。可在 **设置 → 高级 → VRChat API 请求间隔下限保护** 调整等待秒数（默认 60s，硬性下限 30s），请勿将间隔配置得过小，以免触发风控。
- **非官方声明**：VRCX-Pro 是社区增强分支，**非 VRChat 官方产品**，与 VRChat Inc. 无隶属关系。VRChat 及其相关商标归 VRChat Inc. 所有。
- **禁止用途**：本项目不包含也不支持批量用户抓取、自动刷、自动加好友、绕过官方限制等违规功能。

## 贡献

欢迎提交 Issue 和 Pull Request。大型变更请先开 Issue 讨论方案，小修复可直接提交 PR。

详见 [贡献指南](.github/CONTRIBUTING.md)。

---

## MIT License

本项目基于 [MIT License](LICENSE) 许可协议发布。

> VRCX-Pro by Yusurmount is not endorsed by VRChat and does not reflect the views or opinions of VRChat or anyone officially involved in producing or managing VRChat properties. VRChat and all associated properties are trademarks or registered trademarks of VRChat Inc. VRChat © VRChat Inc.
