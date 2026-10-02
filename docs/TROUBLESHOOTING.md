# 故障排查

先确认错误发生在哪一层：Vite 前端、Vitest、Rust、.NET sidecar、SQLite、MCP 或 VRChat API。不要在没有证据时改动无关代码。

## 启动与开发环境

### `npm run tauri:dev` 启动失败

按顺序检查：

```powershell
node --version
npm --version
rustc --version
cargo --version
dotnet --version
```

确认 Node/npm 满足 `package.json` 的 `engines`，Rust stable 和 .NET SDK 9 已安装，Windows 已安装 WebView2 Runtime。再运行：

```powershell
npm install
npm run build:tauri-backend
npm run tauri:dev
```

`tauri:dev` 会先构建 framework-dependent sidecar，再启动 Vite。若 Vite 端口 9000 被占用，先关闭占用进程；若 sidecar 构建失败，优先查看 `dotnet publish` 输出。

### 页面启动后一直停留在加载层

启动层等待路由、页面资源和数据库初始化三类信号。检查：

1. 浏览器/WebView 控制台是否有 `[boot-state]` 或初始化异常。
2. 数据库文件是否可读，是否存在损坏或磁盘满错误。
3. 侧边栏或窗口尺寸变化是否导致组件初始化异常。
4. 是否使用 `--startup`，该参数会故意不显示主窗口。

6 秒兜底只会在后端变慢时显示主窗口，不能替代数据库初始化。

### 窗口或缩放不符合预期

主窗口最小尺寸是 800×600。窄窗口缩放由 `src/services/windowZoom.js` 按逻辑宽度应用：

- 宽度 `< 880`：最多 85%；
- 宽度 `< 960`：最多 90%；
- 其他宽度：使用用户手动缩放基线。

运行目标测试：

```powershell
npx vitest run src/services/__tests__/windowZoom.test.js
npx vitest run src/views/Sidebar/__tests__/SidePanelRail.test.js
```

若使用启动参数，先阅读[启动参数文档](LAUNCH_ARGS.md)，确认该参数在当前实现中确实有消费路径。

## Lint、格式与类型

### `npm run lint` 失败

先运行只针对改动文件的检查，确认是否为既有问题：

```powershell
npx eslint <changed-file>
npx oxlint <changed-file>
```

常见原因：

- 直接修改其他 Store 的 `*Store.*` 字段；
- Vue 模板使用未导入组件或错误的 v-for/v-if；
- 测试文件没有被 ESLint 的测试 globals 覆盖；
- 代码不符合仓库现有格式。

修复自己引入的问题；不要为了清零而删除无关代码。

### `npm run format:check` 失败

运行 `npm run format` 后检查 diff，只保留与本次需求相关的格式变化。不要批量重排未修改文件。

### `npm run typecheck:js` 报 `'tsc' is not recognized`

该命令依赖本地 TypeScript 可执行文件。先检查：

```powershell
npm ls typescript --depth=0
```

如果未安装，这是工具链缺失，不是类型检查通过。恢复或添加 TypeScript 开发依赖后再运行命令；不要把失败伪装成通过。

## 测试

### 目标测试失败

使用具体路径运行：

```powershell
npx vitest run <path/to/file.test.js>
```

确认失败是否由本次修改引入。测试替身位于 `vitest.setup.js`，原生 IPC、平台 API、`localStorage`、`Notification` 等在 jsdom 中被替换；不要在测试中访问真实 sidecar、网络或用户数据库。

### 全量测试有既有失败

区分目标测试、全量测试和原生层验证：

```powershell
npm test
```

若失败在改动前已存在，记录基线并报告新增失败，不要通过删除测试或降低断言掩盖问题。

### `npm run test:coverage` 没有覆盖 Rust/.NET

Vitest 只发现 `src/**/*.{test,spec}.js`。Rust 使用 `cargo check`/`cargo test`，.NET 使用 `npm run build:tauri-backend` 和 `npm run probe:tauri-backend`。

## Rust 与 Tauri

### `cargo check` 失败

```powershell
cargo check --manifest-path src-tauri/Cargo.toml
```

检查：

- 新命令是否加入 `invoke_handler`；
- 类型、生命周期和 `State` 锁是否正确；
- 是否使用了当前 Tauri 版本未启用的特性；
- 是否误改了生成的 `Cargo.toml` 版本以外的无关内容。

### `npm run verify:tauri` 失败

该脚本检查 Electron/CEF 回归和 Tauri 资源边界。失败项通常包括：

- `package.json` 引入了旧 Electron 依赖；
- 恢复了 `src-electron`、`Installer` 或旧构建入口；
- `frontendDist` 不是 `../build/html`；
- Tauri bundle 缺少 `../build/TauriBackend` 资源。

逐项查看脚本输出，不要删除检查来“修好”构建。

## .NET sidecar 与 IPC

### `Class.Method` 返回错误或未定义

确认三层都存在：

1. 前端调用对应的 `window.platform` 或 InteropApi；
2. Rust `dotnet_call` 已注册；
3. `Dotnet/TauriBackend/Program.cs` 分支已实现。

运行：

```powershell
npm run build:tauri-backend
npm run probe:tauri-backend
```

检查参数是否仍保持 JSON 类型；不要把结构化对象无意义地字符串化。

### 数据库被锁定或只读

常见原因：

- 另一个 VRCX/调试实例正在写同一 SQLite 文件；
- 磁盘空间不足；
- 备份或同步工具锁定了文件。

关闭其他实例后重试。不要直接删除正在使用的 `-wal`/`-shm` 文件，也不要在没有备份的情况下手工修改数据库。

## 数据库

数据库默认位于：

```text
%APPDATA%\VRCX\VRCX.sqlite3
```

数据库管理页面会显示实际路径、版本、日志模式、表数量和表预览。

### 数据库升级失败

1. 先备份 `%APPDATA%\VRCX` 目录。
2. 查看控制台中的 `Updating database from ... to ...` 和具体异常。
3. 检查 `src/services/database/index.js`、`tableFixes.js`、`src/stores/vrcx.js` 的版本迁移。
4. 用兼容旧库的测试验证迁移，再尝试启动。

不要手工执行未提交的 `ALTER TABLE`，也不要覆盖用户数据库。

## MCP Server

### 服务无法启动

设置入口：**设置 → 集成 → MCP Server**。

检查：

- 开关是否开启，状态是否为 Running；
- 端口是否在 1024–65535，且没有被其他进程占用；
- 数据库文件是否存在：`%APPDATA%\VRCX\VRCX.sqlite3`；
- 控制台是否输出 `Database not found` 或 `Failed to bind`。

### AI 客户端无法连接

使用 Streamable HTTP 端点：

```text
http://127.0.0.1:<port>/mcp
```

MCP 只监听 `127.0.0.1`，默认关闭，不提供远程地址。客户端配置、工具参数和资源 URI 见 [MCP 文档](MCP.md)。修改工具后必须重新执行 `tools/list` smoke test。

### 查询结果为空

MCP 只读取本地数据库，不会主动抓取 VRChat 数据。确认：

- 已登录并完成一次数据同步；
- 对应 feed、cache、notification 或 friend 表已有记录；
- 查询的用户 ID、类型和时间范围正确。

## VRChat API 限流

请求层遇到 429 会应用至少 30 秒的轮询降速。可检查 **设置 → 高级 → VRChat API 请求间隔下限保护**，不要把保护间隔调到硬性下限以下，也不要增加批量抓取或并发请求。

## 收集问题信息

提交 Issue 或寻求排查时提供：

- 操作系统、WebView2、Node、Rust、.NET 版本；
- 启动命令和 `Version`/`version_channel`；
- 第一个错误堆栈，而不是只粘贴最终提示；
- 是否涉及数据库、MCP、代理或 `--startup`；
- 已运行的验证命令及结果。

不要附带真实 token、Cookie、数据库文件或包含个人信息的截图。
