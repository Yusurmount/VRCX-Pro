---
name: vrcx-pro-dev
description: "Work on the VRCX-Pro Tauri 2 + Vue 3 desktop app: views and components, Pinia stores and coordinators, TanStack query cache, VRChat API and request layer, .NET 9 sidecar IPC, SQLite schema and migrations, MCP server, localization, and version/build scripts. Use when the task targets the VRCX-Pro repository or this layered desktop architecture."
---

# VRCX-Pro Development

VRCX-Pro is a Windows-first desktop app built from four cooperating layers: a Vue 3 + Vite frontend, a Tauri 2 Rust shell, a .NET 9 sidecar, and a local SQLite database. Each layer owns different behavior, so put changes in the layer that owns the behavior and verify at that layer.

Before planning or editing project code, read the repository knowledge base at `docs/KNOWLEDGE_BASE.md`. Read task-specific documentation before editing when applicable: `docs/UI.md` for UI and component-library work, `docs/MCP.md` for MCP changes, `docs/LAUNCH_ARGS.md` for startup or command-line changes, and the relevant `docs/compose/spec/*.md` for feature work covered by a compose spec. Check documentation against current code when details may have changed.

Read `references/project-map.md` for the file layout, layer contracts, project invariants, and the verification matrix before making non-trivial changes.

## Working Agreement

- Read the repository `AGENTS.md` and `CLAUDE.md`, then run `git status --short` and treat existing modifications as the user's work.
- Complete each task in its own git worktree; if the task has no dedicated worktree yet, create one before editing. Never mix independent tasks in a single working tree.
- Keep every changed line traceable to the request. Match the surrounding style; do not refactor or reformat adjacent code.
- Multi-step product behavior is ambiguous more often than it looks. State assumptions, or ask before implementing.
- The project deliberately mirrors upstream VRCX behavior while adding an enhancement layer. Do not invent upstream behavior or silently broaden scope.
- When a task adds new UI (view, dialog, component, or new triggerable state), add a matching option in the UI debug tool `src/views/Settings/dialogs/UIDebugDialog.vue` (entry: 设置 > 界面调试工具) so the new surface can be opened and exercised directly. Route the new option's strings through Vue I18n and keep `en`, `zh-CN`, and `zh-TW` consistent.
- After finishing changes in a git repository, ask whether to commit the relevant files. Never push, pull, discard changes, delete untracked files, or use force without explicit instruction.

## Task Closure

When wrapping up a task, before reporting it done:

- Update the relevant documentation under `docs/` to reflect the change — `docs/KNOWLEDGE_BASE.md` for architectural or behavioral shifts, the matching topic doc (`docs/MCP.md`, `docs/LAUNCH_ARGS.md`, `docs/TESTING.md`, …), or the relevant `docs/compose/spec/*.md` for feature work. If no doc covers the changed area, create one.
- Self-update this skill: fold durable learnings (new invariants, file locations, verification steps, pitfalls) back into `SKILL.md` or `references/project-map.md`. Keep edits concise and scoped to knowledge that future sessions will need; do not paste task logs.

## Dependency Direction

Follow the existing flow rather than reaching across layers:

`View -> Coordinator -> Store -> API -> Service -> IPC -> Rust -> .NET -> VRChat API / SQLite`

- Views render and dispatch; multi-store orchestration belongs in `src/coordinators/`.
- Business UI should compose `src/components/ui/` primitives. Use `Panel` for repeated dialog surfaces and `ColorInput` / `ColorSwatch` for color controls instead of adding local styled buttons, inputs, or surface CSS.
- Stores own their own state. Never assign or increment another store's state directly, even though the proxy makes it look legal.
- VRChat endpoints belong in `src/api/`; transport, rate limiting, and retry behavior belong in `src/services/request.js`. Do not bypass `request()` for VRChat calls.
- Remote entity caching lives in `src/queries/`; invalidate using the keys in `src/queries/keys.js` instead of hardcoding key arrays.
- Native access goes through `src/platform/runtime.js` and `src/ipc/interopApi.js`, then the Rust commands and the .NET dispatch. Do not reintroduce Electron, CEF, or Node-native paths.

## Constraints Worth Remembering

- Local data lives in SQLite and stays local. Do not add code that uploads VRCX data to third parties.
- Per-user tables are prefixed per logged-in account. Schema changes must be idempotent and compatible with existing databases, applied through the database service migration paths rather than ad hoc runtime `ALTER TABLE`.
- Respect the existing VRChat API rate-limit handling and the public-data-only scope. Do not add bulk scraping or automation.
- The MCP server must stay loopback-only, off by default, and read-oriented. Treat expanding its exposure or write surface as a change that needs explicit user intent.
- User-visible strings go through Vue I18n and should be kept consistent across `en`, `zh-CN`, and `zh-TW`.
- User-visible copy names the product **VRCX-Pro** (locale files, hardcoded modal/toast/dialog strings, export reports — including the tracked-nonfriends `add_dialog_hint`, which once said `VRCX-jirai`). Keep bare `VRCX` only for: protocol identifiers (`VRCX-ID` header, Sentry DSN `VRCX-WEB-*`), file/path names (`VRCX.png`, `VRCX.desktop`, `%AppData%\VRCX`), config keys / table prefixes (`VRCX_*`), and upstream links in README/docs. Rule recorded in `docs/UI.md` §基本原则.
- `Version` and `version_channel` drive the release version. Builds rewrite `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` from those files, so expect and account for those edits.
- Intimacy scoring (`useRelationshipScoring.js`) is a five-criteria λ-Choquet model (`contact`/`regularity`/`recency`/`trend`/`activity` + `intimacyLambda`). The `intimacyWeights` config is only accepted when it contains all five keys — anything older silently falls back to defaults. `getFriendshipMetrics()` returns block-summed `totalTime`, gap-chained `joinCount`, plus `activeWeeks`/`time30d`/`timePrev30d`/`friendNumber`/`friendInitiated`/`selfInitiated`; see `docs/KNOWLEDGE_BASE.md` §6.11 before touching dimension keys or the metrics contract.

## Verification

Match the depth of verification to the blast radius, and report exactly what ran and what did not:

- Frontend logic, stores, components: `npm run lint`, `npm run typecheck:js`, and the relevant `npx vitest run <path>` files; run `npm test` once shared behavior is touched.
- Rust shell, capabilities, packaging: `cargo check` in `src-tauri` plus `npm run verify:tauri`.
- .NET sidecar or IPC surface: `npm run build:tauri-backend`, and `npm run probe:tauri-backend` when call semantics change.
- Database, MCP, or other runtime behavior: exercise it against a real database or running endpoint; do not treat a clean compile as behavioral proof.
- IPC performance or large-data behavior: `python scripts/measure-ipc-latency.py` (expect sub-ms local reads while a slow HTTP is in flight) against a dataset from `python scripts/seed-performance-dataset.py`.

## Environment pitfalls & tooling

- **Baseline discipline**: compare against a stash-based baseline in the same worktree/toolchain (`git stash push -u` → run → `git stash pop`); comparing with another checkout gives false deltas (different eslint versions, dirty sibling sessions). Strip timings/colors from vitest FAIL lines before diffing.
- **dotnet build**: this machine's tool shell lacks `ProgramFiles`; set `$env:ProgramFiles = 'C:\Program Files'` before any `npm run build:tauri-backend*` or NuGet fails with `Value cannot be null (Parameter 'path1')`.
- **Frontend JS diagnosis**: fastest console access is headless Edge — `msedge --headless=new --enable-logging=stderr --v=0 --virtual-time-budget=12000 --dump-dom http://localhost:9000/` (captures `Uncaught ...` module errors). `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port` does NOT work under Tauri. A module-graph link error (bad named import) kills the entire app before any code runs — check imports first.
- **`@tauri-apps/api/path` exports `tempDir` (camelCase)**, not `tempdir`; a wrong name is an ESM link-time SyntaxError that halts boot with no visible trace in vite logs.
- **Dev instance conflicts**: single-instance lock — check `Get-Process vrcx-pro` before `tauri:dev`. If `tauri dev`'s own vite serves broken dep URLs, run `npx vite serve src --port 9000` standalone and launch `npx tauri dev --config <file>` where the file sets `{"build":{"beforeDevCommand":""}}` (no repo file changes).
- **Performance regression tools** (kept): `scripts/seed-performance-dataset.py` (synthetic big tables, auto-backup, idempotent seed rows `id>=900000000`) and `scripts/measure-ipc-latency.py` (slow-HTTP-vs-local-read key experiment; baseline local read was ~4.9s, must stay sub-ms). To remove seeded rows later: `DELETE ... WHERE id >= 900000000` on the five seeded tables, then `VACUUM`.
- **IPC invariant**: responses may complete out of order; callers route by id (Rust assigns the sidecar id and rewrites the response id back to the caller's). `.NET Handle` must echo the request id on errors. SQLite stays single-connection — frontend transactions span separate `BEGIN`/`COMMIT` RPC lines.
- **Sidecar dispatch lanes + game-log latency（2026-10 修复）**: `Program.Main` gates **local** short calls (SQLite/KV/LogWatcher/AppApi) with `dispatchGate` taken *in the read loop*, but `WebApi` HTTP (VRChat API, up to 60s) takes a separate `httpGate` *inside* the task — the read loop must never await HTTP, else a slow-request burst stops it reading stdin and every local call behind it (incl. `LogWatcher.Get()`) queues to the HTTP timeout. EOF drains by an in-flight counter (`Volatile.Read`), not by re-acquiring gates. Classification uses `JsonSerializer.Deserialize<RpcRequest>` (case/space-robust), not substring matching — PowerShell `ConvertTo-Json` emits `"ClassName": "WebApi"` with a space and defeats a naive `"className":"WebApi"` contains-check. Frontend: `LogWatcher.Get()` polls in its **own** loop (`startGameLogPolling`/`pollGameLog` in `updateLoop.js`) so a slow `getUsersGroupInstances()` (60s) in `updateLoop` can't stall it. Repro: fire 40 `WebApi.ExecuteJson` at `http://10.255.255.1/`, then time a `LogWatcher.Get` — must stay ~20ms (was ~15s, and >75s with a bigger burst). Upstream `Dotnet/LogWatcher.cs` polls on a dedicated thread for the same reason.
- **游戏日志必须只消费完整行（2026-10 复发）**：`Dotnet/TauriBackend/LogWatcher.cs` 的 `ReadNewLines` 必须是**字节级读取、只解析以 `\n` 结尾的完整行**，`context.Position` 只推进到最后一个换行符之后（残行留在文件里下次重读，不缓存、不重复）。若回退成 `StreamReader.ReadLine()` + `context.Position = stream.Position`，轮询撞上 VRChat 正在写入的半行时会把半行当完整行消费并越过它，**永久丢失**该行（切房间 `Joining wrld_...`、`OnPlayerJoined`/`OnPlayerLeft`）。游戏运行时房间状态完全由游戏日志驱动（`runSetCurrentUserLocationFlow` 在 `isGameRunning` 时提前返回、不用 WebSocket `user-location`），丢一条 `location` 就让**房间列表、玩家列表、当前用户状态、资料卡房间全部停在旧房间**——这就是“换房后仍显示旧房间、进退人不刷新”的偶发根因。相关：`src-tauri/tauri.conf.json` 主窗口的 `additionalBrowserArgs` 必须保留 `IntensiveWakeUpThrottling` + `--disable-background-timer-throttling/occluded-windows/renderer-backgrounding`（该字段整体替换 wry 默认参数，需连同默认 `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection` 一起写），否则窗口被 VRChat 遮挡时 webview 定时器被压到 ~1 次/分钟、轮询停摆。二者是独立问题：残行丢失“永不恢复”，节流“看窗口才恢复”。验证：`npm run build:tauri-backend` + `npm run verify:tauri`（无 .NET 测试工程，需真机跑 VRChat 切房验证）。
- **Fresh worktrees have no `node_modules`**: run `New-Item -ItemType Junction -Path node_modules -Target <main-checkout>\node_modules` before any `npm`/`npx` (tree matches the same commit, junction stays gitignored). Caveat: `npm install <pkg>` inside such a worktree removes the junction (the link only — main checkout's `node_modules` stays intact) and does a full local install in the worktree; that's fine, just delete the real `node_modules` directory when cleaning the worktree afterwards (plain `rmdir` on the junction is not enough once it's a real dir).

## Feature pointers & known baselines

- **亲密度评分**：核心 `src/views/Charts/composables/useRelationshipScoring.js`，唯一消费方 `Charts/components/RelationshipIntimacy.vue`；设计 `docs/compose/spec/intimacy-scoring.md`，知识库 `docs/KNOWLEDGE_BASE.md` §6.11。`recency` = 双指数衰减 `0.6·e^(-d/14) + 0.4·e^(-d/120)` × 接触密度折价（`distinctDays ÷ 关系年龄`，参考密度 0.1、下限 0.5），非法 `lastSeen` 记 0、未来时间戳钳为 0 天、`firstSeen` 缺失不打折。改动须同步三语 `view.charts.intimacy.weights.explain.recency` 与上述两份文档。
- **共存数据语义（易踩坑）**：`<prefix>_feed_gps` / `<prefix>_feed_online_offline` 记录的是**好友自己**在某实例的停留时长与上下线，与「是否和我在一起」无关；只有 `gamelog_join_leave`（我的游戏日志）能证明同实例共存。`gameLog.getFriendshipMetrics()` 已按真共存计算（游戏日志会话直接计入 + feed 会话与我的会话按同 `location` 求交、区间合并），改它需同步 `docs/KNOWLEDGE_BASE.md` §6.11。`getRelationshipTimelineData()` 仍走未求交的 `buildPresenceSessionsQuery`，口径不同——动时间线前先修这个。
- **全量基线（master，2026-10）**：`npm test` = 37 files / 153 tests FAIL，全部既有；`npm run lint` = 69 warnings / 38 errors（oxlint 先跑且非零退出会短路 eslint，改动文件用 `npx eslint <files>` 单独验，`gameLog.js` 另有 3 个既有 `no-redeclare`）；`npm run typecheck:js` 因 `tsc` 未安装不可用（既有环境缺口）。
- **卡片式单选 `RadioCard`**：`src/components/ui/radio-card/`，整卡为 `<label for>`（点击卡片任意处即选中），选中边框由全局单选状态驱动（`has-[[data-state=checked]]:border-primary`），业务侧只传 `id`/`value`/文案。消费方：OOBE 恢复步骤、数据库恢复向导、UI 画廊。jsdom 29 会把 label 点击转发给 button，整卡点击可直接在组件测试中断言；规范见 `docs/UI.md`。
- **引导对话框（已合并）**：`src/components/onboarding/WelcomeDialog.vue` 是唯一入口——欢迎语头部 + 下方 What's New 特性卡片（内容来自 `vrcxUpdater` store 的 `whatsNewDialog`）。打开条件**仅**为 `VRCX_onboarding_personal_welcome_seen` 未置位（原欢迎对话框语义：800ms 延迟、CTA 恒为「开始使用」、关闭即标记看过）；升级公告由 `vrcxUpdater.presentWhatsNewRelease()`（`showWhatsNewDialog`/`showLatestWhatsNewDialog` 共用）先清除该标记再发布内容，对话框随标记到期弹出。**恒为新样式**：`maybeOpen()` 过门禁后若无公告内容（全新安装、调试「欢迎引导」重开），先调 `showLatestWhatsNewDialog()` 填入最新版卡片再打开；仅有已加载公告时不覆盖；`whatsNewReleases` 完全无数据才回落纯欢迎头。独立的 `WhatsNewDialog.vue` 已删除，勿再创建；UI 调试工具「欢迎引导」「新功能」两个入口共用此对话框、呈现同一新样式。行为说明见 `docs/KNOWLEDGE_BASE.md` §6.1，测试在 `src/components/onboarding/__tests__/WelcomeDialog.test.js`。
- **开发者好友提示对话框**：`src/components/onboarding/DevFriendDialog.vue`，欢迎对话框 `handleDismiss` → `requestDevFriendDialogShow()` 触发（500ms 延迟）；条件 = `VRCX_onboarding_dev_friend_seen` 未置位且（开发者 `usr_166e8c0b-cfe1-47c3-ab7e-9d14874be6ae` 在 `friendStore.friends` 中 **或 当前登录用户就是开发者本人**，本人时跳过好友检查；好友列表未加载完会等 `watchState.isFriendsLoaded`，15s 超时兜底）。头像数据源回退链：好友条目 `ref` → `userStore.cachedUsers` → `userRequest.getUser()` 拉取（调试 force 预览时本地无数据，必须走到第三级才有头像）；每次打开播放 `canvas-confetti` 彩炮动画（左右礼炮+中心盛放，`isOpen` watch 触发，jsdom 测试需 mock `canvas-confetti`；**必须传 `zIndex = BASE_Z_INDEX * 2`（20000）**——对话框 portal 在 `modalPortalLayers.js` 的 10000 堆叠上下文里，默认 zIndex 100 会被遮罩盖住，`BASE_Z_INDEX` 已导出）；关闭即标记看过。状态模块 `devFriendDialogState.js`（force 标志供 UI 调试「开发者好友提示对话框」入口跳过好友条件）。改它需同步 `docs/KNOWLEDGE_BASE.md` §6.1，测试在 `src/components/onboarding/__tests__/DevFriendDialog.test.js`。
- **「直接打开」入口兜底**：左菜单 `direct-access` / Ctrl+D → `search.directAccessPaste()` → 读剪贴板 → 解析失败才弹 `promptOmniDirectDialog()`。`window.platform.getClipboardText()` 是裸的 Tauri `readText()`（**会 reject**，不同于 `call()` 吞错返 null），且 `directAccessParse()` 内部 `new URL()` 对畸形输入抛错——两处任何一处抛出都会让整个流程静默死亡、对话框不弹。`directAccessPaste` 已对两段都 try/catch 并回落到输入对话框；改动它需保持该兜底，测试在 `src/stores/__tests__/directAccessPaste.test.js`，知识库 `docs/KNOWLEDGE_BASE.md` §7.2。
- **数据库恢复进度**：`executeImport`（`src/services/database/exportImport.js`）先建导入计划再写——分母只算真正会导入的行（`cookies`/`sqlite_*`/敏感 configs/`table_missing` 不计入），所以完成必为 100%；`onProgress` 发 `ImportProgressState`，其中 `percent` 是 **0–100 整数**，为进度条宽度与文案百分比的唯一来源（勿再各自取整/换算），另带 `table`/`tableIndex`/`tableCount`/`tableRowsDone`/`tableRowsTotal`/`processedRows`/`totalRows`。恢复向导 `DatabaseRestoreWizard.vue` 第 4 步在进度条下渲染 `db_import.progress_detail_{clearing,importing}`（三语同步）。UI 调试工具「对话框 > 数据库恢复进度」→ `src/views/Tools/restoreProgressPreviewState.js` → `DatabaseManagement.vue` 以 `debugProgressPreview` 打开向导模拟进度（不写库、可取消、不进重启步骤）。测试：`exportImport.test.js`（进度契约）、`DatabaseRestoreWizard.test.js`（条/百分比一致 + 明细行 + 预览入口）；知识库 `docs/KNOWLEDGE_BASE.md` §6.12。
- **版本更新弹窗**：`src/components/dialogs/VRCXUpdateDialog.vue`。大标题右侧是线路选择（文本按钮+下拉箭头，`DropdownMenuCheckboxItem` 官方/镜像），**任意时刻可切换**：`setUpdateRoute()` 落库后立即 `checkForVRCXUpdate()` 用新线路重新获取 releases；镜像线路下 `getRoutedUpdateUrl()` 覆盖 `github.com`/`api.github.com`/release 资产域名，经 `gh-proxy.org` 转发（更新检查与安装包下载同受线路影响）。关闭叉左上方的三点菜单（触发按钮为原生 `<button>`，类名与 `DialogContent` 的关闭叉一致：`opacity-70 hover:opacity-100 rounded-xs size-4 图标`）含「接受Beta测试」「提醒版本更新」复选与「更改版本」（打开 GitHub releases），页脚不再放更改版本按钮；仅在有操作时渲染页脚，下载/安装按钮居中（`min-w-44 sm:min-w-56`）。复选语义：接受Beta → `VRCX_acceptBeta`（`store.setAcceptBeta()` 落库后重跑 `checkForVRCXUpdate()`），控制是否纳入 `prerelease` / 非 Release 渠道构建；提醒版本 → 复用 `VRCX_autoUpdateVRCX`（勾选=非 `Off`，重新勾选回落 `Notify`）。版本比较 `src/shared/utils/version.js`：数字相同后按 Release > Beta > It 定序（`-beta`/`-it` 后缀），同版本 it 会提示其 Release 更新；最新版由 `pickLatestRelease()` 在已放行的候选里挑，无候选即视为无更新（不再回落 `json[0]`）。测试：`VRCXUpdateDialog.test.js`、`src/stores/__tests__/vrcxUpdater.test.js`、`src/shared/utils/__tests__/version.test.js`；知识库 `docs/KNOWLEDGE_BASE.md` §12 版本管理。
- **玩家列表高级筛选信任等级**：判定键 = `computeTrustLevel(tags, developerType).trustColorKey`（`src/shared/utils/userTransforms.js`，与设置 > 界面 > 好友名称显示颜色同一算法），键为 `untrusted/basic/known/trusted/veteran/vip/troll` + `unknown`（行无 `tags` 数组）；选项文案复用 `view.settings.appearance.user_colors.trust_levels.*`（三语），旧的 `settings.general.user_colors.*` 块已删除。**勿用 `$trustLevel` 判等级**：其值是 `Known User`/`Trusted User` 长名，且 troll/vip 只覆盖 `trustColorKey`。旧预设等级键在 `cloneFilterState()` 迁移。测试 `src/views/PlayerList/__tests__/playerListFilters.test.js`，知识库 `docs/KNOWLEDGE_BASE.md` §6.7。
