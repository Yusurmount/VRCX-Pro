# 测试指南

自动化测试覆盖前端 JavaScript/Vue 层；Rust、.NET 和真实 SQLite/MCP 行为需要另行验证。

## 命令矩阵

| 变更范围 | 命令 | 说明 |
| --- | --- | --- |
| 单个函数、组件或 Store | `npx vitest run <path>` | 快速确认目标行为 |
| 前端共享逻辑 | `npm test` | Vitest 全量运行 |
| 前端覆盖率 | `npm run test:coverage` | 生成 text/text-summary 报告 |
| JS 类型 | `npm run typecheck:js` | 需要本地 `tsc` 可用 |
| Lint | `npm run lint` | oxlint + ESLint |
| 格式 | `npm run format:check` | oxfmt 检查 |
| Rust shell | `cargo check --manifest-path src-tauri/Cargo.toml` | 编译检查 |
| Tauri 迁移约束 | `npm run verify:tauri` | 检查 Electron/CEF 是否回归 |
| .NET sidecar | `npm run build:tauri-backend` | 发布构建 |
| IPC 调用语义 | `npm run probe:tauri-backend` | 真实 sidecar probe |
| MCP Rust 行为 | `cargo test --manifest-path src-tauri/Cargo.toml` | 工具查询与边界测试 |
| IPC 并发/大数据性能 | `python scripts/measure-ipc-latency.py` | 慢 HTTP 期间本地读延迟关键实验（基线约 4.9s，应保持亚毫秒） |
| 合成大数据集 | `python scripts/seed-performance-dataset.py --db <path> [--scale N]` | 自动备份、幂等（种子行 `id>=900000000`），用于性能回归 |

`npm test` 的测试发现规则是 `src/**/*.{test,spec}.js`，测试环境为 jsdom，原生绑定由 `vitest.setup.js` 替身提供。

## 测试组织

- `src/api/__tests__/`：端点封装与查询同步。
- `src/queries/__tests__/`：缓存键、策略、实体缓存。
- `src/stores/__tests__/`：Store action 和状态转换。
- `src/coordinators/__tests__/`：跨 Store 工作流。
- `src/services/__tests__/`：请求、WebSocket、配置、窗口缩放等服务。
- `src/components/**/__tests__/`：组件与对话框。
- `src/views/**/__tests__/`：页面交互、路由相关行为。
- `src/localization/__tests__/`：语言解析和文案一致性相关行为。

测试文件应靠近被测模块，使用现有替身和测试工具；不要通过真实 VRChat API、真实数据库或网络获取测试数据。

## 推荐写法

```javascript
describe('feature', () => {
    test('applies the expected transition', async () => {
        const result = await runFeature({ enabled: true });

        expect(result).toEqual({ enabled: true });
    });
});
```

优先断言行为和边界：

- 成功路径、空数据、异常输入；
- 限流、超时、401/403/404/429 分支；
- 本地存储不可用、窗口尺寸缺失、IPC 返回 `null`；
- 三种语言文案键和关键组件状态。

避免断言内部实现细节（不必要的 DOM 顺序、私有变量、随机 ID），也不要在测试中依赖真实用户数据库。

## 按风险选择验证

| 风险 | 最低验证 |
| --- | --- |
| 纯工具函数 | 目标 Vitest + lint |
| Vue 页面/组件 | 目标 Vitest + lint + 受影响交互 |
| Store/coordinator | owner-action 测试 + 相关功能测试 |
| API/query | 请求与缓存测试 + lint |
| 本地化 | 语言键一致性 + 受影响组件 |
| 数据库迁移 | 迁移测试 + 兼容旧库的运行验证 |
| Rust | `cargo check` + `npm run verify:tauri` |
| .NET/IPC | `build:tauri-backend` + `probe:tauri-backend` |
| MCP | `cargo test` + `tools/list`/`tools/call` smoke test |

## 已知工具链状态

`typecheck:js` 调用本地 `tsc`。如果 `npm ls typescript` 显示未安装，命令会以 `'tsc' is not recognized` 失败；这属于工具链缺失，不应伪装成类型检查通过。安装或恢复 TypeScript 开发依赖后再运行该命令，并在变更说明中记录实际结果。

前端全量测试可能存在与本次改动无关的既有失败。报告测试结果时必须区分：

- 本次目标测试是否通过；
- 全量测试是否存在既有失败；
- Rust、.NET 或 MCP 是否实际运行了验证。

## 提交前最小清单

```powershell
npm run format:check
npm run lint
npx vitest run <affected-tests>
```

跨层改动再按命令矩阵补齐 `npm test`、`cargo check`、`npm run verify:tauri`、`.NET build/probe` 或 `cargo test`。文档变更至少执行本地 Markdown 链接检查。
