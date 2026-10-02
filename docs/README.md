# VRCX-Pro 文档

本文档目录是仓库文档入口。代码行为与文档冲突时，以当前代码和对应测试为准，并同步修正文档。

## 核心文档

| 主题 | 文档 | 适用场景 |
| --- | --- | --- |
| 架构与数据流 | [ARCHITECTURE.md](ARCHITECTURE.md) | 跨层改动、模块边界、依赖方向 |
| 完整项目参考 | [KNOWLEDGE_BASE.md](KNOWLEDGE_BASE.md) | 目录、Store、IPC、数据库与功能索引 |
| 开发流程 | [DEVELOPMENT.md](DEVELOPMENT.md) | 环境、常用命令、新增模块、提交前检查 |
| UI 组件库与样式 | [UI.md](UI.md) | 新 UI、样式替换、组件扩展与视觉验证 |
| 测试与验证 | [TESTING.md](TESTING.md) | 测试范围、命令矩阵、已知工具链状态 |
| 发布与打包 | [RELEASE.md](RELEASE.md) | 版本、渠道、安装包与便携版 |
| 故障排查 | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 启动、构建、窗口与运行问题 |
| 安全边界 | [SECURITY.md](SECURITY.md) | 本地数据、网络、MCP 与权限约束 |
| 启动参数 | [LAUNCH_ARGS.md](LAUNCH_ARGS.md) | 命令行参数与窗口行为 |
| MCP Server | [MCP.md](MCP.md) | 本地 MCP 工具、资源与端点 |

## 专题规格

功能设计说明位于 `docs/compose/spec/`。当实现跨越多个模块或需要保留明确设计取舍时，优先新增或更新对应专题规格，并在相关实现和测试中引用。

## 维护约定

- 文档使用项目支持的语言编写，术语与代码保持同一命名。
- 修改行为、契约、验证命令或用户工作流时，同步更新本目录对应条目。
- 新增 UI 组件或调整组件库约定时，更新 [UI.md](UI.md) 和 [KNOWLEDGE_BASE.md](KNOWLEDGE_BASE.md)。
- 新增或调整验证矩阵时，更新 [TESTING.md](TESTING.md)。
- 文档中的相对链接必须指向仓库内真实文件；不要保留失效入口。
