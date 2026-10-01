---
feature: startup-loading-states
status: delivered
updated: 2026-10-01
branch: fix/startup-loading-states
commits: 75c96ec6..b568d0fe
---

# 启动期加载状态与侧边栏/数据库管理延迟修复

## Report

**What was built** — 通过临时插桩量化了启动瓶颈（前端 boot 仅 0.3s，但 sidecar 队列出现约 15s 阻塞、登录后数据洪峰排队 4–8s、侧边栏三步串行导致自定义布局约 51s 才生效），随后在前端范围内完成四类修复：(1) App 挂载时静默窗口内预取 dashboard 与侧边栏自定义配置（`navConfigUtils` 单次消费），NavMenu onMounted 并行化，自定义布局从 ~51s 降为挂载后 ~17ms（实测 loadDashboards 30135ms→1ms、loadNavMenuConfig 12409ms→16ms）；(2) 启动链路表格接入 loading 门控——Favorites 三视图新增 `isLocalFavoritesLoading` 计数门控、notification 读库窗口先置 loading（含失败复位）、FriendsLocations 就绪前显示加载、Feed/GameLog widget 接入 loading；(3) 数据库管理页加载期间显示 spinner、行数统计由 N 次 `COUNT(*)` 往返合并为单条 `UNION ALL`、overview 与表清单并行；(4) 插桩全部为临时代码，交付前已移除。

**Verification** — `oxlint .` 71 warnings/38 errors 与 master 完全一致；改动文件 `eslint` 仅预存问题；改动代码文件 `oxfmt --check` 全部通过（全仓 format:check 在 master 即失败，PRE-EXISTING）；`tsc -p tsconfig.checkjs.json`（临时 typescript@5.9.3，仓库未声明 typescript）255 行 vs master 255 行、无新增错误；全量 `npm test`：master 38 failed files/155 failed tests/2072 passed → 工作树 37/153/2079（**零新增失败**，并修复了预存的 NavMenu.test）；定向测试 NavMenu 2/2、navConfigUtils 3/3、DatabaseManagement 4/4（含单条 COUNT 断言）、notification 7/7、FriendsLocations 6/6 全部通过；`tauri:dev` 运行时 A/B 与冒烟（无 transform/panic 错误，前后端进程正常）。

**Journey log**：
- 工具 shell 与机器级环境缺失 `ProgramFiles` 环境变量 → NuGet `Path.Combine(null)` 使 `dotnet publish`/`dotnet nuget locals` 全部失败；设 `ProgramFiles` 后恢复。该问题独立于本仓库，建议系统侧修复。
- 运行时插桩发现启动最大瓶颈是 sidecar 约 15s 的锁等待/阻塞（首个配置读取起卡满 busy_timeout），登录后所有查询排队其后——属 .NET/SQLite 层，本轮范围外，建议单独立项排查（含双连接自锁/写锁持有者排查）。
- master 基线本身红：全量测试 38 failed files、oxlint 38 errors、部分文件未过 oxfmt、`typecheck:js` 因未安装 typescript 无法运行——验证一律以“相对 master 无新增”为准。
- 预存的 NavMenu.test 2/2 失败（缺 `stores/settings/notifications` mock）顺手补齐 mock 后转绿。
- 临时插桩把耗时 JSON 写入 `%TEMP%\vrcx-startup-probe.json`（经 `platform.writeFile`），免开 DevTools 即可做 A/B。

## [S1] Problem

应用启动加载数据库期间存在三个用户可见问题：

1. 许多表格/视图直接渲染“无数据”（`common.no_data`），而不是加载中状态；空态判定只看数组长度，数据未就绪与真的无数据无法区分。
2. 侧边栏先同步渲染默认布局，等启动期所有串行 IPC（主题色 → dashboard → 导航配置）走完才切换为用户自定义布局。
3. 数据库管理页（`tools/database`）在其他数据加载完之后还要延迟很久才有数据，且列表期间无任何 loading 指示（`loading` 仅用于禁用刷新按钮）。

已知根因（探索+插桩结论）：.NET sidecar 严格串行处理请求 + 单 SQLite 连接写锁；启动期迁移/修复/各 store init 全部排同一条队列；前端多处缺少 loading 门控；导航配置加载被串行 await 链推迟。

## [S2] Design

用户决策：本轮做“插桩 + 前端修复”，不动 .NET sidecar 结构；插桩为临时代码，修复验证后全部移除。

### 1. 临时插桩（诊断阶段，交付前移除）

- 前缀 `[startup-probe]`，输出 `performance.now()` 时间戳的阶段耗时日志，并把事件 JSON 写入 `%TEMP%\vrcx-startup-probe.json` 供离线 A/B。
- 覆盖：app.js 各 await 阶段、vrcx.init 各阶段、sqlite 慢调用（≥30ms）、各 store init 起止、NavMenu 三步、DatabaseManagement refreshAll。
- 已执行并移除（交付态无残留）。

### 2. 侧边栏自定义布局尽早生效

- App.vue setup（静默窗口）：`store.dashboard.ensureLoaded()` + `prefetchStoredNavConfig(configRepository)` 提前排队两次 config 读取。
- `navConfigUtils`：预取 promise 单次消费（`takePrefetchedNavConfig`），消费后恢复常规读取，外部 `NAV_LAYOUT_UPDATED_EVENT` 重读不受影响；异 key 忽略预取。
- `dashboard.loadDashboards` 增加并发去重（`inFlightLoad`），`ensureLoaded()` 返回 promise。
- `NavMenu onMounted`：`initThemeColor()` 不再阻塞后续，`await ensureLoaded()` 后 `await loadNavMenuConfig()` 并行收敛。
- 保持同步默认占位的首屏设计不变。
- 验收（实测）：loadDashboards 30135ms→1ms、loadNavMenuConfig 12409ms→16ms，自定义布局挂载后 ~17ms 应用。

### 3. 表格空态 → loading 门控

- Favorites 三视图：favorite store 新增 `localFavoritesLoadingCount` + `isLocalFavoritesLoading`（begin/end 计数，登出复位），三个 `getLocal*Favorites` 用 try/finally 包裹；FavoritesFriend/World/Avatar 的 `nodata` 空态在 loading 时渲染 Spinner。
- notification：`initNotifications` 读库前置 `isNotificationsLoading=true`，失败路径复位为 false（避免永久转圈）。
- FriendsLocations：空态增加 `friendListLoading`（`!watchState.isFriendsLoaded || isRefreshFriendsLoading || isLocalFavoritesLoading`），未就绪显示 Loader2 而非 nomatch。
- Dashboard widgets：FeedWidget 接 `feedTable.loading`；GameLogWidget 新增 `isLoading`（finally 复位）。
- Charts（HotWorlds/AvatarUsage/InstanceActivity）已有 `isLoading` 门控，无需修改。
- 每处优先复用已有 loading 字段；确无的在所属 store 增加。

### 4. 数据库管理页

- 列表区在 `loading` 期间渲染 Spinner，结束后才显示 `select_hint`。
- `loadTables` 行数统计改为单条 `UNION ALL`（标识符 `""` 转义、字符串字面量 `''` 转义），N 次往返降为 1 次。
- `refreshAll` 中 overview 与表清单 `Promise.all` 并行。
- 不改 sidecar 调度。

### 5. 插桩移除与回归

- 已删除 `startupProbe.js` 及全部引用（全仓 grep 无残留）。
- 回归测试：navConfigUtils 预取 3 例、notification loading 窗口+失败复位 2 例、DatabaseManagement 单条 COUNT 断言、NavMenu（补 mock 后）转绿。

## [S3] Out of Scope

- .NET sidecar 并行化 / 读写分离 / 队列调度改造。
- 迁移与 tableFixes 算法优化、VACUUM 策略调整。
- **约 15s 的 sidecar 启动锁等待/阻塞**（插桩新发现，属 .NET/SQLite 层，建议单独立项）。
- 永久性插桩或 AppDebug 门控的诊断设施。
- Search 页面空态改造：其数据来自 VRChat API 而非本地库，已有 `isSearch*Loading` spinner，空态为“未搜索”提示，与启动 DB 队列无关。
- 全仓所有硬编码 `:loading="false"` 的一次性清理。
- 登录/OOBE 流程本身的行为变更。
- 仓库基线问题：master 既有 38 个失败测试文件、38 个 oxlint errors、部分文件未过 oxfmt、未安装 typescript 导致 `typecheck:js` 不可用。

## Tasks

- [x] T1: 临时插桩覆盖启动各阶段并采集一次基线耗时 — acceptance: 运行应用后输出 `[startup-probe]` 各阶段耗时，能读出瓶颈排序（实测得到 15s 阻塞/数据排队/侧边栏 51s 串行的完整排序） (covers: S2 §1)
- [x] T2: 侧边栏导航配置提前并行加载 — acceptance: 启动后自定义导航布局在数据就绪后立即应用，不再依赖串行链尾部；相关测试通过（实测 51s→17ms；NavMenu 2/2、navConfigUtils 3/3） (covers: S2 §2; depends: T1)
- [x] T3: 启动链路表格接入 loading 门控 — acceptance: 启动期 Favorites 等页面显示 loading 而非“无数据”；notification 初始读取窗口期不再显示空态（含失败复位）；相关测试通过（notification 7/7、FriendsLocations 6/6；Search/Charts 经评估已有门控或不适用） (covers: S2 §3; depends: T1)
- [x] T4: 数据库管理页 loading 与 COUNT 批量化 — acceptance: 打开数据库管理页立即显示 loading；表行数查询从 N 次往返降为 1 次；相关测试通过（DatabaseManagement 4/4，含单条 COUNT 断言） (covers: S2 §4; depends: T1)
- [x] T5: 移除全部临时插桩并完成验证 — acceptance: 仓库无 `[startup-probe]` 残留；`oxlint`/`eslint`/typecheck/全量 `npm test` 相对 master 基线无新增失败（master 基线 38 failed files 为 PRE-EXISTING；本分支为 37 failed files 并修复预存 NavMenu.test） (covers: S2 §5; depends: T2, T3, T4)
