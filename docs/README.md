# VRCX-Pro 文档

VRCX-Pro 是基于 VRCX 的社区增强桌面应用，由 Vue 3、Tauri 2、Rust、.NET 9 sidecar 和本地 SQLite 组成。这里的文档按阅读目的分层：先找任务入口，再进入对应参考。

## 按任务阅读

| 你想做什么 | 阅读 |
| --- | --- |
| 了解产品能力与构建方式 | [README](../README.md) |
| 理解分层、数据流和模块归属 | [架构总览](ARCHITECTURE.md) |
| 查看完整目录、路由、数据库和开发约定 | [项目知识库](KNOWLEDGE_BASE.md) |
| 搭建开发环境、修改页面/API/IPC | [开发指南](DEVELOPMENT.md) |
| 编写或运行测试 | [测试指南](TESTING.md) |
| 发布版本、打包安装程序 | [发布指南](RELEASE.md) |
| 排查启动、构建、数据库或 MCP 问题 | [故障排查](TROUBLESHOOTING.md) |
| 检查数据、网络和 MCP 安全边界 | [安全与隐私](SECURITY.md) |
| 配置 AI 客户端访问本地数据 | [MCP Server](MCP.md) |
| 使用命令行启动参数 | [启动参数](LAUNCH_ARGS.md) |
| 查看功能设计与验收记录 | [功能规格](compose/spec/) |

## 文档约定

- 内部链接使用相对路径，链接目标必须是仓库中的实际文件。
- 命令示例以 Windows/PowerShell 为主；可跨平台的命令会直接标注。
- 代码示例必须与当前实现一致，不能把推测当作行为描述。
- 涉及版本、构建、MCP 工具或数据库路径时，以 `Version`、`version_channel` 和对应源码为事实来源。
- 不在文档中记录真实 token、密码、Cookie、私有 URL 或用户数据库内容。
- 功能规格记录设计与验收结论；需要了解当前实现时，同时查看关联源码。

## 当前功能规格

| 文档 | 主题 |
| --- | --- |
| [intimacy-scoring.md](compose/spec/intimacy-scoring.md) | 好友亲密度评分模型 |
| [bio-diff-history.md](compose/spec/bio-diff-history.md) | 简介历史版本对比 |
| [small-window-auto-zoom.md](compose/spec/small-window-auto-zoom.md) | 小窗口自动缩放 |
| [startup-loading-states.md](compose/spec/startup-loading-states.md) | 启动加载状态与侧边栏延迟修复 |

## 维护清单

修改文档时按此顺序检查：

1. 对照源码或实际命令确认事实。
2. 更新文档索引和相关交叉链接。
3. 运行仓库根目录的本地链接检查。
4. 运行受影响的测试；文档没有代码变更时至少完成链接与命令校验。
5. 不要提交无关文件或生成物。
