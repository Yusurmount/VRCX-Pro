# VRCX-Pro Project Map

Detailed reference for the VRCX-Pro repository. Read the sections relevant to the current task; nothing here is loaded until the skill is in use.

## Runtime Shape

```
Vue View
  -> Coordinator
  -> Pinia Store
  -> API module
  -> request / SQLite / WebSocket service
  -> InteropApi or window.platform
  -> Tauri Rust command
  -> .NET JSON-RPC sidecar (stdin/stdout)
  -> VRChat API / local SQLite / desktop OS
```

Real-time events travel the other way: the VRChat Pipeline WebSocket feeds the store and coordinator layers, which drive reactive view updates. TanStack Vue Query owns remote entity caching; Pinia owns application and domain state.

Toolchain: Node.js 24.10.0+, npm 11.5.0+, Rust stable, .NET SDK 9.x, and WebView2 on Windows.

## Source Map

| Surface | Primary locations | Put changes here when |
| --- | --- | --- |
| Pages and feature UI | `src/views/`, `src/components/`, `docs/参考/UI规范.md` | Rendering, dialogs, page workflows, reusable UI, component-library rules |
| UI debug tool | `src/views/Settings/dialogs/UIDebugDialog.vue` | New UI gets a debug trigger; entry: 设置 > 界面调试工具 |
| State ownership | `src/stores/` | A feature owns reactive state or performs one atomic transition |
| Cross-store workflows | `src/coordinators/` | Login, sync, game-log, favorites, cache, or event flows spanning stores and services |
| VRChat endpoints | `src/api/` | Adding or changing a public VRChat API operation |
| Request behavior | `src/services/request.js` | Retry, throttling, deduplication, or error semantics |
| Remote entity cache | `src/queries/` | Query keys, stale/gc policies, entity patches, invalidation |
| Persistence | `src/services/database/`, `src/services/sqlite.js` | Schema, migration, table repair, database access |
| WebSocket events | `src/services/websocket.js` | Pipeline event dispatch or reconnect behavior |
| Desktop bridge | `src/ipc/interopApi.js`, `src/platform/runtime.js` | Frontend access to Tauri or .NET |
| Tauri shell | `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/` | Commands, windows, tray, sidecar lifecycle, permissions |
| MCP server | `src-tauri/src/mcp.rs`, `docs/参考/MCP服务器.md` | MCP protocol, tools, resources, local queries |
| .NET sidecar | `Dotnet/TauriBackend/` | JSON-RPC dispatch, WebApi, SQLite, AppApi, log watching |
| Localization | `src/localization/` | User-visible strings, language behavior |
| Version and build | `Version`, `version_channel`, `build-scripts/`, `scripts/` | Release channel, packaging, sidecar build, migration guard |
| Documentation | `README.md`, `docs/`, `TAURI_MIGRATION.md` | User-facing overview, architecture, MCP, launch arguments, migration notes |

`README.md` is the product overview. `docs/参考/项目知识库.md` is the project's own deep architectural reference. `docs/参考/MCP服务器.md` covers the MCP server and `docs/参考/启动参数.md` covers command-line behavior.

## Layer Contracts

### API and query cache

- API modules export async functions per VRChat endpoint and delegate transport to `src/services/request.js`.
- `request()` owns GET deduplication, failed-endpoint backoff, 429 throttling, auth and error semantics, and response parsing. Use it instead of raw `fetch()` for VRChat calls.
- Cache keys are centralized in `src/queries/keys.js`; entity retention policies are in `src/queries/policies.js`; event-driven entity updates use `src/queries/entityCache.js`.
- A mutation invalidates the specific related keys, not the whole cache.

### Stores and coordinators

- Each Pinia store owns its state transitions; ESLint rejects cross-store assignment and increment/decrement.
- Coordinators are plain exported functions that orchestrate multi-store and multi-service workflows.
- Views may call a coordinator or query hook, but should not become a second orchestration layer.

### IPC and sidecar

- `src/ipc/interopApi.js` maps `ClassName.Method(...args)` onto the Tauri `dotnet_call` command through a Proxy.
- `src/platform/runtime.js` installs `window.platform` and wraps Tauri plugins and native commands.
- .NET dispatch lives in `Dotnet/TauriBackend/Program.cs`; a new class or method must exist there for the proxy call to resolve.
- Preserve JSON argument types through `dotnet_call`; do not stringify structured values needlessly.
- New Tauri commands are registered in `src-tauri/src/lib.rs`; permission changes belong in `src-tauri/capabilities/`.
- IPC is concurrent: Rust assigns each request a sidecar id, routes responses back by id on a dedicated reader thread, and rewrites the response id to the caller's original value (responses may complete out of order). .NET backpressures with `SemaphoreSlim(32)` in the read loop and drains in-flight responses on EOF; error responses must echo the request id.
- There is no cross-request FIFO. Any flow that needs ordering must await the previous promise — `database.begin()/commit()` return the `executeNonQuery` promise for exactly this reason.

### SQLite and migrations

- Local data lives in `%APPDATA%/VRCX/vrcx.db`.
- Per-user tables use a sanitized prefix derived from the account id in `src/services/database/index.js`. Global tables hold game logs, caches, favorites, memos, configs, and cookies.
- SQLite runs in WAL mode with a busy timeout, so keep writes compatible with concurrent MCP reads.
- The sidecar keeps a **single SQLite connection** (ReaderWriterLockSlim) — frontend transactions are sent as separate `BEGIN`/`COMMIT` RPC lines, so the shared connection is the transaction-semantics foundation. Do not introduce a connection pool without a transaction-pinning design.
- Schema changes must be idempotent and compatible with existing databases, and should be routed through the database service migration and table-repair paths.

### MCP

- `src-tauri/src/mcp.rs` serves MCP over local HTTP from Rust and reads SQLite directly rather than going through the sidecar.
- Bind only to loopback, keep the server disabled by default, and keep access read-oriented apart from the supported local note write.
- Changing a tool, query, or resource means updating `docs/参考/MCP服务器.md` and smoke-testing `http://127.0.0.1:<port>/mcp`.
- Keep the documented tool count aligned with `mcp_tools()` and the resource list aligned with `resources/list`.

## Project Invariants

- `Version` and `version_channel` are the canonical release inputs. Supported channels are `Release`, `Beta`, and `It`, producing an empty, `-beta`, and `-it` suffix respectively; `package.json` is not the release-version source.
- `npm run tauri:build` runs `build-scripts/sync-version.js`, which rewrites the version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`. Expect these edits and report them instead of treating them as stray changes.
- Vite injects `WINDOWS`, `LINUX`, `NIGHTLY`, `VERSION`, and `VERSION_CHANNEL` as build constants. Platform booleans must stay real code literals; a stringified `"false"` is truthy and breaks platform detection.
- `npm run verify:tauri` blocks reintroduction of Electron and CEF dependencies, directories, build entrypoints, and packaging settings.
- Vitest only discovers `src/**/*.{test,spec}.js`, runs in jsdom with globals enabled, and stubs native bindings in `vitest.setup.js`.
- The automated suite is frontend-only. Rust and .NET changes need compilation or runtime verification and are not covered by `npm test`.
- `build/`, `src-tauri/target/`, and `Dotnet/**/obj|bin` are generated output. Do not hand-edit them or commit unrelated regenerated files.

## Verification Matrix

| Changed surface | Minimum useful verification |
| --- | --- |
| Pure JS utility | Targeted Vitest, `npm run lint`, `npm run typecheck:js` |
| Vue component or view | Targeted Vitest plus lint and typecheck; local UI check when interaction or layout changes |
| Store or coordinator | Owner-action tests, affected feature tests, lint, typecheck |
| API or query layer | Request and query-sync tests, lint, typecheck |
| Localization | Locale key consistency plus affected component tests |
| Database schema or query | Targeted database tests, then a runtime check against an existing compatible database when migrations are involved |
| Tauri Rust | `cargo check` in `src-tauri`, then `npm run verify:tauri` |
| .NET sidecar or IPC | `npm run build:tauri-backend`; add `npm run probe:tauri-backend` for call-surface changes |
| IPC performance or large-data behavior | `python scripts/measure-ipc-latency.py` (slow-HTTP-vs-local-read key experiment) plus `python scripts/seed-performance-dataset.py` for a reproducible big dataset |
| MCP | Rust compile, local endpoint and tool smoke test, `docs/参考/MCP服务器.md` consistency |
| Version or build scripts | The relevant script, `npm run verify:tauri`, and `npm run prod` or a full Tauri build when packaging is affected |

For a change spanning layers, run the union of the relevant checks. Start with the narrowest Vitest file that covers the behavior, then widen to `npm test` only when shared behavior is involved.

## Common Commands

```powershell
npm install
npm run tauri:dev
npm run dev
npm run format:check
npm run lint
npm run typecheck:js
npx vitest run path/to/suite.test.js
npm test
npm run test:coverage
npm run build:tauri-backend
npm run probe:tauri-backend
npm run verify:tauri
npm run prod
npm run tauri:build
python scripts/seed-performance-dataset.py --db <path> [--scale N]
python scripts/measure-ipc-latency.py [--delay-ms 5000]
```

Packaging entrypoints: `build-scripts/build-install-package.cmd` for the NSIS installer, `build-scripts/build-portable-package.cmd` for the portable build.
