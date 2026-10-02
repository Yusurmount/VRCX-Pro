# 开发指南

本文聚焦“怎么改”；架构归属和完整目录见[架构总览](ARCHITECTURE.md)与[项目知识库](KNOWLEDGE_BASE.md)。

## 环境要求

| 工具 | 要求 | 用途 |
| --- | --- | --- |
| Node.js | `>= 24.10.0` | Vite、Vitest、构建脚本 |
| npm | `>= 11.5.0` | 依赖与脚本入口 |
| Rust | stable | Tauri shell |
| .NET SDK | 9.x | sidecar 与 probe |
| WebView2 | Windows 必需 | 桌面 WebView |
| Git | 已配置仓库 | 变更追踪 |

先执行：

```powershell
npm install
npm run tauri:dev
```

前端单独调试使用 `npm run dev`，它不会启动 Rust 和 .NET sidecar。

## 常用命令

```powershell
npm run dev                 # Vite 前端开发服务器
npm run tauri:dev           # Rust + 前端 + .NET sidecar 开发模式
npm run lint                # oxlint + ESLint
npm run typecheck:js        # JS 类型检查（需要 tsc 可用）
npm run format              # oxfmt 格式化
npm test                    # Vitest 全量测试
npx vitest run <path>       # 单个测试文件
npm run build:tauri-backend # .NET 发布
npm run verify:tauri        # 禁止 Electron/CEF 回归
npm run prod                # 前端生产构建与第三方许可
npm run tauri:build         # 版本同步 + Tauri 完整打包
```

命令的验证范围和失败处理见[测试指南](TESTING.md)、[发布指南](RELEASE.md)和[故障排查](TROUBLESHOOTING.md)。

## 修改约定

1. 先读当前文件及其相邻测试，匹配既有风格。
2. 每一行改动都应能对应到用户需求。
3. 不重构无关代码，不删除工作区中已有的未提交改动。
4. 用户可见文字同时更新 `src/localization/en.json`、`zh-CN.json`、`zh-TW.json`。
5. 远程请求必须通过 `src/services/request.js`。
6. 缓存失效使用 `src/queries/keys.js` 的工厂函数。
7. 不直接赋值或自增其他 Store；把操作放到该 Store 的 action。
8. 数据库变更必须是幂等、可兼容旧库的迁移，不直接修改用户数据库文件。

## 新增页面

1. 在 `src/views/` 创建页面目录和组件。
2. 在 `src/plugins/router.js` 的路由表中加入懒加载路由。
3. 需要导航时更新导航配置和相应国际化文案。
4. 页面状态放入已有 Store，或新增单一职责 Store。
5. 远程数据优先使用 `src/queries/useEntityQueries.js` 或查询 hook。
6. 添加至少覆盖关键交互的 Vitest 测试。

受保护路由的 OOBE、登录和重定向行为由 `src/plugins/router.js` 的 `beforeEach` 统一控制，不要在页面中重复实现。

## 新增 API 调用

```javascript
import { request } from '../services/request.js';

export async function getUser(userId) {
    return request(`users/${userId}`, { method: 'GET' });
}
```

Mutation 完成后按需失效对应实体缓存，例如：

```javascript
import { queryClient } from '../queries/index.js';
import { queryKeys } from '../queries/keys.js';

queryClient.invalidateQueries({ queryKey: queryKeys.user(userId) });
```

不要绕过 `request()` 使用原始 `fetch()`；限流、去重、错误和 Cookie 语义都依赖这条路径。

## 新增或修改 Store

- 使用 `defineStore()`，在 `src/stores/index.js` 导出并按现有方式注册。
- 状态转换放入 action，保持单个 action 可独立测试。
- 需要跨 Store 时调用 coordinator，不直接修改另一个 Store。
- 持久化设置明确选择 `ConfigRepository` 或 `VRCXStorage`，沿用现有键名。
- 在 `src/stores/__tests__/` 添加 owner-action 测试。

## 新增协调器

协调器是普通导出函数，用于编排多个 Store 和 Service。它应保持无 UI 状态、可测试、可返回结果或抛出明确错误。复杂流程拆成可观察的步骤，并为关键分支添加测试。

## 新增 IPC 或原生能力

三条路径必须同时存在：

1. 前端调用 `window.platform`、`InteropApi` 或对应的现有代理。
2. Rust 命令在 `src-tauri/src/lib.rs` 实现并加入 `invoke_handler`。
3. 若是 `Class.Method`，在 `Dotnet/TauriBackend/Program.cs` 的分发中实现对应分支。

涉及窗口、托盘、文件、通知时检查 `src-tauri/capabilities/` 权限；涉及 .NET 调用语义时运行 `npm run probe:tauri-backend`。

## 新增 MCP 工具或资源

1. 在 `src-tauri/src/mcp.rs` 的工具定义和调用分发中同时加入。
2. 参数使用 JSON Schema 描述，读操作只查询本地 SQLite。
3. 同步更新 [MCP 文档](MCP.md) 的工具数量、参数和返回字段。
4. 运行 `cargo test`，再对本机启用的端点做 `tools/list` smoke test。
5. 不扩大网络绑定或写入范围；任何新增写能力都需要明确用户意图和安全评审。

## 新增或迁移数据库结构

1. 在 `src/services/database/index.js` 或对应业务模块中加入幂等 `CREATE TABLE IF NOT EXISTS` / 修复语句。
2. 在 `src/stores/vrcx.js` 的版本升级流程中加入迁移步骤。
3. 提升数据库目标版本，并确保旧库升级失败时能提示用户。
4. 为表创建、迁移、导入导出和损坏/锁定分支添加测试。
5. 更新 `docs/KNOWLEDGE_BASE.md` 的数据库设计说明。

不要通过临时 SQL 绕过数据库服务修改现有库，也不要手工编辑 `build/` 中的生成物。

## 国际化

- 文案键放在 `src/localization/<locale>.json`，三种语言保持同一键集合。
- 不把未经翻译的中文硬编码到组件中。
- 使用 `npm run localization` 的辅助命令时，先确认它只改动目标键。
- 添加或修改文案后运行受影响组件测试。

## 提交前检查

```powershell
npm run format:check
npm run lint
npm test
```

跨 Rust/.NET 的改动增加：

```powershell
cargo check --manifest-path src-tauri/Cargo.toml
npm run verify:tauri
npm run build:tauri-backend
```

只提交与需求相关的文件；不要提交 `build/`、`src-tauri/target/`、`Dotnet/**/obj|bin` 或其他生成物。修改完成后，项目有 Git 仓库时询问是否提交相关文件，不擅自推送、拉取或丢弃改动。
