# 架构总览

本文是跨层变更的入口；模块清单、完整路由和数据库表请继续阅读[项目知识库](KNOWLEDGE_BASE.md)。

## 运行时形状

```text
Vue View
  -> Coordinator
  -> Pinia Store
  -> API module
  -> request / TanStack Query / SQLite service
  -> InteropApi 或 window.platform
  -> Tauri Rust command
  -> .NET JSON-RPC sidecar（stdin/stdout）
  -> VRChat API / 本地 SQLite / Windows

VRChat Pipeline WebSocket -> 前端 WebSocket service
  -> Store / Coordinator -> View 响应式更新
```

MCP Server 是旁路：Rust 侧通过 `rusqlite` 直接读取本地数据库，不经过 .NET sidecar，也不调用 VRChat API。

## 分层职责

| 层 | 主要位置 | 负责 | 不负责 |
| --- | --- | --- | --- |
| View | `src/views/`、`src/components/` | 渲染、表单、页面级交互 | 跨 Store 编排、直接写数据库 |
| Coordinator | `src/coordinators/` | 跨 Store、跨 Service 的工作流 | 持有领域状态 |
| Store | `src/stores/` | 领域状态与本 Store 的原子操作 | 直接修改其他 Store |
| API | `src/api/` | VRChat 端点语义与返回数据 | 重试、限流、缓存策略 |
| Request | `src/services/request.js` | GET 去重、错误语义、429 降速 | 页面状态、业务编排 |
| Query | `src/queries/` | 远程实体缓存键、策略和失效 | WebSocket 原始事件 |
| Database | `src/services/database/` | 表创建、迁移、查询与导入导出 | 远程 API 请求 |
| IPC bridge | `src/ipc/`、`src/platform/` | Tauri 命令和 `Class.Method` 代理 | 业务规则 |
| Rust shell | `src-tauri/src/` | 窗口、托盘、sidecar 生命周期、MCP | VRChat 业务状态 |
| .NET sidecar | `Dotnet/TauriBackend/` | HTTP、SQLite、KV、日志与系统 API | Vue 状态管理 |

依赖方向必须保持单向。UI 不应直接拼接 VRChat URL，也不应绕过 `request()` 发起远程请求。

## 核心数据流

### 远程请求

```text
View
  -> Coordinator（需要时）
  -> Store action
  -> API function
  -> request(endpoint, options)
  -> webapiService.execute()
  -> WebApi.ExecuteJson
  -> InteropApi -> invoke('dotnet_call')
  -> Rust -> .NET WebApi
  -> VRChat API
```

`request()` 负责：

- 合并 10 秒内相同 URL 的 GET 请求；
- 对近期 403/404 的 GET 端点执行 15 分钟回退；
- 识别 429 并应用至少 30 秒的轮询降速；
- 统一解析响应、错误码与用户提示。

VRChat 端点必须放在 `src/api/` 并通过 `request()` 调用。

### 本地数据库

```text
Store / Coordinator / View
  -> database service
  -> SQLiteService
  -> SQLite.Execute / SQLite.ExecuteNonQuery
  -> InteropApi -> Rust dotnet_call
  -> .NET SQLite service
  -> %APPDATA%/VRCX/VRCX.sqlite3
```

数据库初始化、升级和表修复由 `src/stores/vrcx.js`、`src/services/database/` 及其迁移路径负责。当前数据库目标版本保存在 `VRCX_databaseVersion` 配置键中。

### 实时事件

```text
wss://pipeline.vrchat.cloud
  -> src/services/websocket.js（浏览器 WebSocket）
  -> handlePipeline()
  -> Store action / Coordinator
  -> View 更新
```

Pipeline WebSocket 由前端直接维护，不经由 .NET sidecar。断线后由服务按登录与好友加载状态决定是否重连。

### 远程实体缓存

```text
API Mutation
  -> queryClient.invalidateQueries({ queryKey })
  -> TanStack Query 重新获取
  -> 使用方组件更新
```

缓存键统一来自 `src/queries/keys.js`，保留策略来自 `src/queries/policies.js`。Mutation 不应硬编码完整 key 数组，也不应默认清空全部缓存。

## 状态归属

- Pinia Store 拥有自己的状态转换；ESLint 禁止直接赋值或自增其他 `*Store`。
- 跨 Store 编排放入 `src/coordinators/`。
- TanStack Query 只管理远程实体缓存，不替代业务 Store。
- 设置持久化区分 `ConfigRepository`（SQLite `configs`）与 `VRCXStorage`（KV `storage.json`），应沿用现有键的归属。
- `watchState` 保存登录、好友、收藏等启动阶段的全局布尔状态。

## 原生边界

### InteropApi

`window.WebApi`、`SQLite`、`VRCXStorage`、`AppApi`、`LogWatcher` 等全局代理来自 `src/ipc/interopApi.js`。调用形状为：

```javascript
ClassName.Method(...args)
  -> invoke('dotnet_call', { className, methodName, args, id })
  -> Dotnet/TauriBackend/Program.cs
```

新增原生方法时，前端调用、Rust 注册和 .NET 分发必须同时存在。

并发模型：Rust 为每个请求分配 sidecar id，写入后即释放锁并按响应 id 路由回等待方（响应可能乱序完成，id 会被改写回调用方原值）；.NET 在读循环处以信号量（32 并发上限）背压并发调度，EOF 时排空全部在途响应。跨请求**没有 FIFO 保证**——依赖顺序的调用方必须真正 `await` 前序 promise（例如 `database.begin()/commit()` 返回 promise 而非 fire-and-forget）。SQLite 保持单连接：前端事务以独立 RPC 行发送 `BEGIN`/`COMMIT`，单连接是事务语义的基础。

### window.platform

`src/platform/runtime.js` 暴露启动、窗口、剪贴板、文件和通知等能力。原生调用失败通常由 `call()` 吞掉并返回 `null`；调用方仍需处理不可用状态。

### 启动就绪

启动画面同时等待：

1. 路由就绪；
2. 页面资源加载完成；
3. 数据库初始化完成并触发 `signalBackendReady()`。

6 秒兜底只负责在后端变慢时显示主窗口，不代表数据库已经可用。

## 项目不变量

- VRCX 用户数据只保存在本地 SQLite/KV 中，不上传到第三方。
- MCP 默认关闭，仅绑定 `127.0.0.1`，默认只读；唯一写工具是本地备注 `vrcx_set_note`。
- SQLite 使用 WAL 和 busy timeout，schema 变更必须幂等并兼容旧库。
- `Version` 与 `version_channel` 是发布版本源，`package.json` 不是。
- 平台构建常量必须保持布尔字面量，不能字符串化。
- 自动化测试覆盖前端；Rust 与 .NET 必须另行编译或运行验证。

## 变更落点

| 需求 | 首选位置 | 必须同步 |
| --- | --- | --- |
| 新页面或交互 | `src/views/`、`src/components/` | 路由、导航、i18n、测试 |
| 跨 Store 流程 | `src/coordinators/` | Store action、测试 |
| VRChat 端点 | `src/api/` | `request()`、缓存失效、测试 |
| 数据库结构 | `src/services/database/` | `vrcx.js` 版本升级、测试、知识库 |
| Rust 命令 | `src-tauri/src/lib.rs` | `invoke_handler`、`window.platform`、能力配置 |
| .NET 方法 | `Dotnet/TauriBackend/Program.cs` | InteropApi 调用、probe |
| MCP 工具 | `src-tauri/src/mcp.rs` | [MCP 文档](MCP.md)、Rust 测试、本地 smoke test |

进一步的操作步骤见[开发指南](DEVELOPMENT.md)，验证矩阵见[测试指南](TESTING.md)。
