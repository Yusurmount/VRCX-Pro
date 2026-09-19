# VRCX-Pro 项目知识库

> 本文档是 VRCX-Pro 项目的全面技术参考，涵盖架构设计、代码组织、开发规范和常见任务。

---

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 技术栈](#2-技术栈)
- [3. 整体架构](#3-整体架构)
- [4. 目录结构](#4-目录结构)
- [5. 核心数据流](#5-核心数据流)
- [6. 前端架构详解](#6-前端架构详解)
  - [6.1 启动流程](#61-启动流程)
  - [6.2 Pinia Stores](#62-pinia-stores)
  - [6.3 Coordinators（协调器）](#63-coordinators协调器)
  - [6.4 Services（服务层）](#64-services服务层)
  - [6.5 API 层](#65-api-层)
  - [6.6 Queries（数据查询）](#66-queries数据查询)
  - [6.7 Views（页面视图）](#67-views页面视图)
  - [6.8 Components（组件）](#68-components组件)
  - [6.9 路由系统](#69-路由系统)
  - [6.10 国际化](#610-国际化)
- [7. 平台桥接层](#7-平台桥接层)
  - [7.1 IPC 机制](#71-ipc-机制)
  - [7.2 Platform Runtime](#72-platform-runtime)
  - [7.3 Boot 流程](#73-boot-流程)
- [8. Tauri 原生层](#8-tauri-原生层)
  - [8.1 Rust 层职责](#81-rust-层职责)
  - [8.2 .NET Sidecar](#82-net-sidecar)
  - [8.3 MCP Server](#83-mcp-server)
- [9. 数据库设计](#9-数据库设计)
- [10. 开发指南](#10-开发指南)
  - [10.1 环境要求](#101-环境要求)
  - [10.2 常用命令](#102-常用命令)
  - [10.3 新增页面](#103-新增页面)
  - [10.4 新增 Store](#104-新增-store)
  - [10.5 新增 API 模块](#105-新增-api-模块)
  - [10.6 新增 Coordinator](#106-新增-coordinator)
  - [10.7 新增 IPC 命令](#107-新增-ipc-命令)
- [11. 测试](#11-测试)
- [12. 构建与打包](#12-构建与打包)
- [13. 与上游 VRCX 的差异](#13-与上游-vrcx-的差异)
- [14. 常见问题](#14-常见问题)

---

## 1. 项目概述

VRCX-Pro 是 [VRCX](https://github.com/vrcx-team/VRCX) 的社区增强分支，是一款 VRChat 好友关系管理桌面工具。在保留上游基础体验的前提下，为动捕玩家、世界/头像创作者及重度用户提供增强功能。

**关键特性：**
- 好友关系管理、上下线状态追踪、收藏管理与分组
- 本地日志解析、备注与标签
- WebSocket 实时通知、垃圾好友请求自动拒绝
- 画廊打印收藏、群组管理与日历导出
- 批量解除审核、实例操作队列提示
- 内置 MCP Server，支持 AI 助手集成

---

## 2. 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面外壳 | **Tauri 2** (Rust) | 替代 Electron/CEF，管理窗口生命周期、系统托盘、单实例锁 |
| 前端框架 | **Vue 3** + Vite + Pinia | 组合式 API，响应式状态管理 |
| UI 组件 | **Tailwind CSS 4** + reka-ui + lucide-vue-next | 实用优先 CSS + 无头 UI 组件 |
| 数据查询 | **TanStack Vue Query** | 服务端状态缓存与同步 |
| 数据表格 | **TanStack Vue Table** | 高性能虚拟化表格 |
| 动画 | **GSAP** | 高性能动画引擎 |
| 表单 | **vee-validate** + Zod | 表单验证 |
| 图表 | **ECharts** | 数据可视化 |
| 后端 sidecar | **.NET 9** (C#) | HTTP 请求代理、SQLite 访问、AppApi |
| MCP Server | **axum** (Rust) | 本地 AI 助手数据接口 |
| 国际化 | **vue-i18n** | 中文简体/繁体/英文 |
| 测试 | **Vitest** + @vue/test-utils | 单元测试 |
| Lint | **oxlint** + ESLint | 代码检查 |
| Format | **oxfmt** | 代码格式化 |

---

## 3. 整体架构

```
┌─────────────────────────────────────────────────────┐
│                   Vue 3 前端                         │
│  Views ──> Stores ──> API Layer ──> Services         │
│              ▲            │              │            │
│              │     Coordinators ◄────────┘            │
│              │                                       │
│         Queries (TanStack Vue Query)                 │
└────────────────────────┬────────────────────────────┘
                         │ invoke()
┌────────────────────────▼────────────────────────────┐
│                 Tauri Rust Shell                      │
│  lib.rs: dotnet_call / read_file / write_file / ...  │
│  mcp.rs: axum HTTP server (MCP Protocol)             │
└────────────────────────┬────────────────────────────┘
                         │ JSON-RPC over stdin/stdout
┌────────────────────────▼────────────────────────────┐
│              .NET 9 Sidecar (C#)                      │
│  VRCXStorage | SQLite | WebApi | AppApi              │
└───────┬────────────────┬────────────────────────────┘
        │                │
   VRChat API       SQLite DB
   (HTTP)           (本地存储)
```

**数据流方向：**
- **用户交互** → View → Coordinator → Store → API → Service → IPC → Rust → .NET → 外部服务
- **实时事件**（反向）：VRChat Pipeline → WebSocket → Store/Coordinator → View 重渲染

---

## 4. 目录结构

```
VRCX-Pro/
├── Dotnet/                          # .NET 后端
│   ├── TauriBackend/                # Sidecar 主程序
│   │   ├── Program.cs               # 入口，JSON-RPC 分发
│   │   ├── WebApi.cs                # HTTP 客户端（代理 VRChat API）
│   │   ├── Sqlite.cs                # SQLite 访问层
│   │   └── VRCXStorage.cs           # KV 存储
│   ├── DBMerger/                    # 数据库合并工具
│   └── libs/                        # 第三方 .NET 库
├── src/                             # Vue 前端源码
│   ├── api/                         # VRChat API 封装模块
│   ├── components/                  # 可复用组件
│   │   ├── dialogs/                 # 对话框组件
│   │   ├── nav-menu/                # 导航菜单
│   │   ├── onboarding/              # 引导组件
│   │   └── ui/                      # 基础 UI 组件库 (60+)
│   ├── composables/                 # Vue 组合式函数
│   ├── coordinators/                # 协调器（编排层）
│   ├── ipc/                         # IPC 桥接
│   ├── lib/                         # 工具库
│   ├── localization/                # 国际化
│   ├── platform/                    # 平台桥接
│   ├── plugins/                     # Vue 插件
│   ├── public/                      # 静态资源
│   ├── queries/                     # TanStack Query 集成
│   ├── services/                    # 基础服务层
│   │   ├── database/                # 数据库 Schema 定义与迁移
│   │   ├── config.js                # KV 配置存储
│   │   ├── request.js               # HTTP 请求核心
│   │   ├── webapi.js                # .NET WebApi 桥接
│   │   ├── sqlite.js                # .NET SQLite 桥接
│   │   └── websocket.js             # VRChat Pipeline WebSocket
│   ├── shared/                      # 共享常量与工具
│   ├── stores/                      # Pinia 状态管理
│   ├── views/                       # 页面级组件
│   ├── App.vue                      # 根组件
│   ├── app.js                       # 应用入口
│   └── index.html                   # HTML 模板
├── src-tauri/                       # Tauri Rust 源码
│   ├── src/
│   │   ├── lib.rs                   # Tauri 命令与 sidecar 管理
│   │   ├── main.rs                  # 入口
│   │   └── mcp.rs                   # MCP Server 实现
│   └── tauri.conf.json              # Tauri 配置
├── build-scripts/                   # 构建脚本
├── scripts/                         # 开发工具脚本
└── docs/                            # 项目文档
```

---

## 5. 核心数据流

### 5.1 用户交互流

```
View (用户点击) 
  → Coordinator (编排多步操作)
    → Store (更新状态) 
      → API Module (调用 VRChat 端点)
        → Service (request.js 处理限流/重试)
          → IPC (InteropApi 代理)
            → Rust (dotnet_call)
              → .NET Sidecar (WebApi.ExecuteJson)
                → VRChat API
```

### 5.2 实时事件流

```
VRChat Pipeline (wss://pipeline.vrchat.cloud)
  → .NET Sidecar (WebSocket 管理)
    → Tauri Event System
      → services/websocket.js (事件分发)
        → Store (状态更新)
          → View (响应式重渲染)
```

### 5.3 缓存与数据同步

```
API Module 执行 Mutation
  → queryClient.invalidateQueries() (清除相关缓存)
    → Vue Query 自动重新获取
      → Store 状态同步更新
```

Entity Cache (LRU) 维护本地实体缓存：
- User: 400 条，staleTime 20s
- Avatar: 200 条，staleTime 60s
- World: 200 条，staleTime 60s
- Group: 100 条，staleTime 5min

---

## 6. 前端架构详解

### 6.1 启动流程

入口文件 [app.js](src/app.js) 的启动顺序：

1. **installRuntimeBridge()** — 安装 `window.platform` 对象
2. **解析 Launch Args** — 读取命令行参数（`--startup`, `--debug`, `--proxy-server` 等）
3. **initPlugins()** — 初始化 Vue 插件（router, i18n, interopApi, sentry 等）
4. **initPiniaPlugins()** — 初始化 Pinia stores
5. **创建 Vue App** — 挂载 Pinia、i18n、Vue Query、组件、路由
6. **等待就绪** — 路由就绪 + 页面加载完成 + 后端数据库初始化完成 → 隐藏启动画面

### 6.2 Pinia Stores

约 45 个 Store，按职责分四类：

| 分类 | 目录/文件 | 说明 |
|------|-----------|------|
| **设置类** | `stores/settings/` | advanced, appearance, general, notifications, discordPresence, wristOverlay |
| **领域类** | `stores/` | auth, user, friend, avatar, world, group, instance, location, favorite, notification, moderation, invite, feed, sharedFeed, gameLog, game, photon, search, quickSearch, gallery, dashboard, charts, activity |
| **UI 类** | `stores/` | ui, modal, tools, externalLink, autoFollow |
| **系统类** | `stores/` | vrcx, vrcxUpdater, updateLoop, vrcStatus, launch, vr, manualRelations, trackedNonFriends, avatarProvider |

**Store 约定：**
- 每个 Store 使用 `defineStore()` 定义
- 设置类 Store 通过 `ConfigRepository` (SQLite KV) 持久化
- Store 通过 `createGlobalStores()` 在启动时统一实例化

### 6.3 Coordinators（协调器）

协调器是编排层，处理跨多个 Store 和 Service 的复杂工作流。

**核心协调器：**

| 协调器 | 职责 |
|--------|------|
| `authCoordinator` | 登录/登出流程，状态重置 |
| `friendSyncCoordinator` | 好友列表初始化与刷新 |
| `vrcxCoordinator` | 跨 Store 缓存清理（保留活跃数据） |
| `autoLoginCoordinator` | 自动登录 |
| `autoFollowCoordinator` | 自动跟随好友 |
| `avatarCoordinator` | 头像缓存管理 |
| `cacheCoordinator` | 数据缓存策略 |
| `favoriteCoordinator` | 收藏同步 |
| `friendPresenceCoordinator` | 好友在线状态追踪 |
| `gameCoordinator` | 游戏状态管理 |
| `gameLogCoordinator` | 游戏日志解析 |
| `instanceCoordinator` | 实例追踪 |
| `inviteCoordinator` | 邀请处理 |
| `locationCoordinator` | 位置追踪 |
| `moderationCoordinator` | 审核管理 |
| `searchIndexCoordinator` | 搜索索引 |
| `userCoordinator` | 用户数据管理 |
| `worldCoordinator` | 世界缓存管理 |

**设计原则：** 协调器不是框架提供的，而是一种约定。它们位于 Store 和 Service 之间，处理需要协调多个 Store 的复杂流程。

### 6.4 Services（服务层）

最底层的前端基础设施，Store 和 Coordinator 依赖它。

| 服务 | 文件 | 职责 |
|------|------|------|
| **request** | `services/request.js` | HTTP 请求核心。GET 请求去重（10s 窗口）、失败端点快速跳过（15min 回退）、429 限流处理、401/403/404 错误处理 |
| **webapi** | `services/webapi.js` | `WebApiService` 类，通过 IPC 调用 .NET `WebApi.ExecuteJson()`，管理 Cookie |
| **sqlite** | `services/sqlite.js` | `SQLiteService` 类，通过 IPC 调用 .NET SQLite，处理数据库错误（损坏/磁盘满/锁定） |
| **websocket** | `services/websocket.js` | VRChat Pipeline WebSocket 连接管理，处理约 20 种事件类型 |
| **config** | `services/config.js` | `ConfigRepository`，SQLite KV 存储 |
| **watchState** | `services/watchState.js` | 响应式状态标志：isLoggedIn, isFriendsLoaded, isFavoritesLoaded |
| **database/** | `services/database/` | 数据库 Schema 定义、表创建、迁移、修复 |

### 6.5 API 层

每个模块封装一组 VRChat API 端点，位于 `src/api/`。

**模块列表：**

| 模块 | 主要功能 |
|------|----------|
| `auth.js` | 登录/登出/2FA |
| `friend.js` | 好友 CRUD、好友请求 |
| `avatar.js` | 头像查询与管理 |
| `world.js` | 世界查询与管理 |
| `user.js` | 用户信息查询 |
| `favorite.js` | 收藏 CRUD |
| `group.js` | 群组管理 |
| `instance.js` | 实例查询与操作 |
| `notification.js` | 通知管理 |
| `playerModeration.js` | 玩家审核（屏蔽/静音） |
| `image.js` | 图片上传 |
| `inventory.js` | 物品清单 |
| `misc.js` | 杂项 API |
| `queryRequest.js` | 分页查询 |
| `vrcPlusIcon.js` | VRC+ 图标 |
| `vrcPlusImage.js` | VRC+ 图片 |
| `inviteMessages.js` | 邀请消息 |
| `prop.js` | 属性管理 |

**API 模块约定：**
- 导出异步函数，每个函数封装一个 VRChat 端点
- 内部调用 `request()` (来自 `services/request.js`)
- Mutation 操作后调用 `queryClient.invalidateQueries()` 清除缓存

### 6.6 Queries（数据查询）

TanStack Vue Query 集成层，提供声明式数据获取。

**核心文件：**

| 文件 | 职责 |
|------|------|
| `queries/client.js` | QueryClient 配置（retry: 1, 无焦点重获取） |
| `queries/keys.js` | 统一缓存键工厂 |
| `queries/policies.js` | 实体缓存策略（staleTime/gcTime） |
| `queries/entityCache.js` | LRU 实体缓存（User 400/Avatar 200/World 200/Group 100） |
| `queries/useEntityQueries.js` | Vue 组合式函数：useUserQuery, useAvatarQuery, useWorldQuery, useGroupQuery |

**缓存策略：**
- User: staleTime 20s, gcTime 90s
- Avatar: staleTime 60s, gcTime 300s
- World: staleTime 60s, gcTime 300s
- Group: staleTime 5min, gcTime 5min
- FileAnalysis: staleTime 60min, gcTime 240min

### 6.7 Views（页面视图）

页面级 Vue 组件，按功能域组织在 `src/views/`。

| 路由 | 视图 | 说明 |
|------|------|------|
| `/login` | `Login/` | 登录页 |
| `/oobe` | `OOBE/` | 首次使用引导 |
| `/` | `Layout/` | 主布局（侧边栏 + 工具栏） |
| `/feed` | `Feed/` | 活动动态流 |
| `/friends-locations` | `FriendsLocations/` | 好友位置地图/列表 |
| `/game-log` | `GameLog/` | 游戏日志查看器 |
| `/player-list` | `PlayerList/` | 当前实例玩家列表 |
| `/search` | `Search/` | 搜索页 |
| `/dashboard/:id` | `Dashboard/` | 用户/头像/世界详情 |
| `/favorites/friends` | `Favorites/Friend/` | 好友收藏 |
| `/favorites/worlds` | `Favorites/World/` | 世界收藏 |
| `/favorites/avatars` | `Favorites/Avatar/` | 头像收藏 |
| `/social/friend-log` | `FriendLog/` | 好友变更记录 |
| `/social/moderation` | `Moderation/` | 审核管理 |
| `/social/friend-list` | `FriendList/` | 好友列表 |
| `/my-avatars` | `MyAvatars/` | 我的头像 |
| `/notification` | `Notifications/` | 通知中心 |
| `/charts/*` | `Charts/` | 数据图表（实例/互关/热门世界/双人/时间线） |
| `/tools` | `Tools/` | 工具页 |
| `/tools/gallery` | `Tools/` (子路由) | 画廊 |
| `/tools/screenshot-metadata` | `Tools/` (子路由) | 截图元数据 |
| `/settings` | `Settings/` | 设置页 |

### 6.8 Components（组件）

`src/components/` 包含可复用组件，其中 `ui/` 是基础组件库（60+ 组件），包含：
- 布局：Card, Sheet, Sidebar, Tabs, ScrollArea, Resizable
- 表单：Input, Select, Checkbox, Switch, Slider, RadioGroup, Textarea
- 反馈：Alert, AlertDialog, Dialog, Sonner (Toast), Progress, Skeleton
- 导航：Breadcrumb, Command, ContextMenu, DropdownMenu, Pagination
- 数据展示：Table, Badge, Avatar, Calendar, Carousel, Tree

### 6.9 路由系统

Vue Router 5，使用 Hash History。

**导航守卫：**
1. **OOBE 门控** — 未完成引导则重定向到 `/oobe`
2. **登录重定向** — 已登录访问 `/login` 则跳转首页
3. **认证检查** — 未登录访问受保护路由则跳转 `/login`

### 6.10 国际化

vue-i18n + 静态 JSON 文件，支持语言：
- `en` — 英文
- `zh-CN` — 简体中文
- `zh-TW` — 繁体中文

语言文件位于 `src/localization/`，通过 BCP-47 代码自动匹配系统语言。

---

## 7. 平台桥接层

### 7.1 IPC 机制

[InteropApi](src/ipc/interopApi.js) 是核心 IPC 桥接，使用 JavaScript Proxy 动态代理：

```javascript
// 前端调用
window.WebApi.ExecuteJson(options)
window.SQLite.Execute(sql)
window.VRCXStorage.Get(key)

// 实际路由
Proxy → invoke('dotnet_call', { className, methodName, args })
  → Rust (lib.rs)
    → .NET Sidecar (stdin/stdout JSON-RPC)
```

全局绑定通过 [plugins/interopApi.js](src/plugins/interopApi.js) 初始化：
- `window.WebApi` — HTTP 请求代理
- `window.SQLite` — SQLite 操作代理
- `window.VRCXStorage` — KV 存储代理
- `window.AppApi` — 应用 API 代理
- `window.LogWatcher` — 日志监听代理（stub）
- `window.Discord` — Discord 集成代理（stub）
- `window.AssetBundleManager` — 资源管理代理（stub）

### 7.2 Platform Runtime

[platform/runtime.js](src/platform/runtime.js) 提供 `window.platform` 对象，封装 Tauri 原生命令：

| 方法 | 功能 |
|------|------|
| `ready` | Sidecar 启动 Promise |
| `launchArgsPromise` | 命令行参数 |
| `getArch` | 系统架构 |
| `getClipboardText` | 读取剪贴板 |
| `setTrayIconNotification` | 系统托盘通知图标 |
| `openFileDialog` | 打开文件对话框 |
| `saveFileDialog` | 保存文件对话框 |
| `writeFile` / `readFile` | 文件读写 |
| `machineEncrypt` / `machineDecrypt` | 机器级加密 |
| `desktopNotification` | 桌面通知 |
| `restartApp` / `quitApplication` | 应用重启/退出 |
| `showMainWindow` / `resizeWindow` / `centerWindow` | 窗口管理 |
| `setCloseToTray` | 关闭时最小化到托盘 |
| `getOverlayWindow` / `updateVr` | VR Overlay（占位） |

### 7.3 Boot 流程

[platform/bootReady.js](src/platform/bootReady.js) 管理启动就绪信号：

```
backendReadyPromise (数据库初始化完成) ─┐
                                        ├─→ tryHideBoot() → 隐藏启动画面
router.isReady() + window.load ─────────┘
```

兜底超时：6 秒后强制显示窗口。

---

## 8. Tauri 原生层

### 8.1 Rust 层职责

[src-tauri/src/lib.rs](src-tauri/src/lib.rs) 是 Tauri 应用的核心：

**Tauri 命令：**
- `dotnet_call` — 调用 .NET Sidecar（核心桥接）
- `start_dotnet_sidecar` — 启动 .NET 子进程
- `read_file` / `write_file` — 文件操作
- `get_overlay_window` / `update_vr` — VR Overlay 占位
- `set_tray_icon_notification` — 托盘通知
- `quit_application` — 退出应用
- `show_main_window` / `resize_window` / `center_window` — 窗口管理
- `open_devtools` — 打开开发者工具
- `get_launch_args` — 获取启动参数

**MCP 命令：**
- `start_mcp_server` / `stop_mcp_server` / `mcp_server_status` — MCP 服务器管理

**其他功能：**
- 系统托盘（Show/DevTools/Reload/Quit）
- 关闭时最小化到托盘
- 单实例锁（防止多开）

**启动参数解析：**
- `--startup` — 启动时最小化
- `--debug` — 调试模式
- `--overlay` — Overlay 模式
- `--disable-gpu` — 禁用 GPU 加速
- `--center` — 窗口居中
- `--config=` — 自定义配置路径
- `--proxy-server=` — 代理服务器
- `--width=` / `--height=` — 窗口尺寸
- `vrcx://` URI — 自定义协议处理

### 8.2 .NET Sidecar

[Dotnet/TauriBackend/](Dotnet/TauriBackend/) 是 .NET 9 控制台程序，通过 stdin/stdout JSON-RPC 通信。

**Program.cs** 入口分发：

| 类名 | 功能 |
|------|------|
| `VRCXStorage` | KV 存储（Get/Set/Remove/GetAll），持久化到 storage.json |
| `SQLite` | SQL 执行（SELECT/INSERT/UPDATE/DELETE/PRAGMA/VACUUM/CREATE/ALTER/DROP），带安全校验 |
| `AppApi` | 版本信息、语言、剪贴板、启动注册表、更新下载/检查/取消、重启、VRChat 路径 |
| `WebApi` | HTTP 请求代理（Cookie 管理、图片上传、代理配置、60s 超时） |

**SQLite 配置：**
- WAL 模式，5s busy timeout
- NORMAL sync，内存 temp store
- 256MB mmap
- 读写锁（ReaderWriterLockSlim）

**安全校验：**
- 允许：SELECT, INSERT, UPDATE, DELETE, PRAGMA, BEGIN, COMMIT, ROLLBACK, VACUUM, WITH, CREATE TABLE/INDEX, ALTER TABLE, DROP TABLE
- 禁止：ATTACH, DETACH, LOAD_EXTENSION, WRITABLE_SCHEMA

### 8.3 MCP Server

[src-tauri/src/mcp.rs](src-tauri/src/mcp.rs) 实现了本地 MCP (Model Context Protocol) 服务器。

**技术选型：** axum + rusqlite + tokio，直接读取 SQLite，不依赖 .NET Sidecar。

**15 个 MCP 工具：**

| 工具 | 功能 |
|------|------|
| `vrcx_get_friends` | 好友列表（状态/信任等级/编号） |
| `vrcx_get_friend_activity` | 好友活动（位置/状态/头像/签名/上下线） |
| `vrcx_get_favorites` | 收藏列表（好友/世界/头像） |
| `vrcx_get_memos` | 备忘录 |
| `vrcx_get_game_log` | 游戏日志 |
| `vrcx_get_notifications` | VRChat 通知 |
| `vrcx_get_moderation` | 审核/屏蔽列表 |
| `vrcx_get_cached_worlds` | 搜索缓存世界 |
| `vrcx_get_cached_avatars` | 搜索缓存头像 |
| `vrcx_get_own_info` | 当前用户信息 |
| `vrcx_get_feed` | 统一 Feed 查询 |
| `vrcx_get_notes` | 用户笔记 |
| `vrcx_get_friend_log_history` | 好友变更记录 |
| `vrcx_list_tables` | 数据库表列表 |

**安全设计：**
- 仅监听 `127.0.0.1`（不暴露网络）
- 只读访问（仅 SELECT）
- 默认关闭，需用户手动启用
- WAL 模式支持并发读取

---

## 9. 数据库设计

SQLite 数据库位于 `%APPDATA%/VRCX/vrcx.db`，表按功能分类：

### 用户相关表（带用户前缀）

| 表名 | 说明 |
|------|------|
| `feed_gps` | 位置移动记录 |
| `feed_status` | 状态变更记录 |
| `feed_bio` | 签名变更记录 |
| `feed_avatar` | 模型更换记录 |
| `feed_online_offline` | 上下线记录 |
| `activity_sync_state_v2` | 活动同步状态 |
| `activity_sessions_v2` | 活动会话 |
| `friend_log_current` | 当前好友列表快照 |
| `friend_log_history` | 好友变更历史 |
| `notifications` | 通知记录 |
| `moderation` | 审核/屏蔽记录 |
| `avatar_history` | 头像使用历史 |
| `notes` | 用户笔记 |
| `mutual_graph_*` | 互关关系图 |
| `tracked_nonfriends` | 非好友追踪 |
| `manual_relations` | 手动关系标记 |

### 全局表

| 表名 | 说明 |
|------|------|
| `gamelog_*` | 游戏日志（位置/加入离开/传送门/视频） |
| `cache_avatar` | 头像缓存 |
| `cache_world` | 世界缓存 |
| `favorite_friend` | 好友收藏 |
| `favorite_world` | 世界收藏 |
| `favorite_avatar` | 头像收藏 |
| `memos` | 用户备忘录 |
| `world_memos` | 世界备忘录 |
| `avatar_memos` | 头像备忘录 |
| `avatar_tags` | 头像标签 |
| `configs` | 应用配置 KV |
| `cookies` | HTTP Cookie |

---

## 10. 开发指南

### 10.1 环境要求

- **Node.js** ≥ 24.10.0
- **npm** ≥ 11.5.0
- **Rust** (最新 stable)
- **.NET SDK** 9.x
- **平台 WebView 前置依赖**（Windows: WebView2）

### 10.2 常用命令

```bash
# 安装依赖
npm install

# 本地开发
npm run tauri:dev

# 前端开发（不启动 Tauri）
npm run dev

# 生产构建
npm run prod

# Tauri 后端构建
npm run build:tauri-backend

# 完整打包
build-scripts/build-install-package.cmd      # 安装包
build-scripts/build-portable-package.cmd    # 便携版

# 代码检查
npm run lint           # oxlint + ESLint
npm run typecheck:js   # TypeScript 类型检查
npm run format         # 格式化

# 测试
npm run test           # 单元测试
npm run test:coverage  # 覆盖率

# 验证 Tauri 迁移完整性
npm run verify:tauri
```

### 10.3 新增页面

1. 在 `src/views/` 下创建页面组件目录
2. 在 `src/plugins/router.js` 中添加路由配置
3. 在 `src/components/nav-menu/` 中添加导航项（如需要）
4. 使用 Pinia Store 管理页面状态
5. 使用 `useUserQuery` / `useWorldQuery` 等获取数据

### 10.4 新增 Store

```javascript
// src/stores/myFeature.js
import { defineStore } from 'pinia';

export const useMyFeatureStore = defineStore('myFeature', {
    state: () => ({
        // 初始状态
    }),
    actions: {
        // 操作方法
    }
});
```

在 `src/stores/index.js` 中导入并注册到 `createGlobalStores()`。

### 10.5 新增 API 模块

```javascript
// src/api/myModule.js
import { request } from '../services/request.js';
import { queryClient } from '../queries/index.js';
import { queryKeys } from '../queries/keys.js';

export async function getMyData(id) {
    const response = await request({
        url: `https://api.vrchat.cloud/api/1/my-endpoint/${id}`,
        method: 'GET'
    });
    return response;
}

export async function updateMyData(id, data) {
    const response = await request({
        url: `https://api.vrchat.cloud/api/1/my-endpoint/${id}`,
        method: 'PUT',
        body: data
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.myData(id) });
    return response;
}
```

### 10.6 新增 Coordinator

```javascript
// src/coordinators/myCoordinator.js
import { useMyStore } from '../stores/myFeature.js';
import { useOtherStore } from '../stores/otherFeature.js';

export function runMyWorkflow() {
    const myStore = useMyStore();
    const otherStore = useOtherStore();
    
    // 编排多个 Store 的操作
    myStore.setData(/* ... */);
    otherStore.updateState(/* ... */);
}
```

协调器在 `src/coordinators/` 目录下，以函数形式导出，由 View 或 Store 调用。

### 10.7 新增 IPC 命令

**前端侧：** 通过 InteropApi 代理自动路由，无需额外配置。

**Rust 侧（src-tauri/src/lib.rs）：**
```rust
#[tauri::command]
fn my_new_command(arg: String) -> Result<String, String> {
    // 实现逻辑
    Ok(result)
}
```

在 `tauri::Builder` 的 `.invoke_handler()` 中注册。

**.NET 侧（Dotnet/TauriBackend/Program.cs）：**
在 `HandleRequest()` 的分发逻辑中添加新的 `className` 分支。

---

## 11. 测试

测试使用 Vitest，位于各模块的 `__tests__/` 目录。

**测试覆盖的模块：**
- `src/api/__tests__/` — API 层（entityQuerySync, favoriteQuerySync, friendQuerySync, groupQuerySync, mediaQuerySync, queryRequest）
- `src/components/__tests__/` — 组件（AvatarInfo, BackToTop, DisplayName, Emoji, Location, LocationWorld, StatusBar, Timer）
- `src/queries/__tests__/` — 查询层（entityCache, keys, policies）
- `src/services/__tests__/` — 服务层（config, confusables, gameLog, request, security）

```bash
npm run test           # 运行所有测试
npm run test:coverage  # 生成覆盖率报告
```

---

## 12. 构建与打包

### 构建流程

```
npm run prod (前端 Vite 构建 + 第三方许可生成)
  ↓
npm run build:tauri-backend (.NET 发布)
  ↓
tauri build (Rust 编译 + WebView 打包 + NSIS 安装程序)
```

### 输出

- 安装包：`VRCX-Pro_x.x.x_x64-setup.exe`（NSIS，perMachine）
- 便携版：通过 `build-portable-package.cmd` 生成
- 前端产物：`build/html/`
- .NET 产物：`build/TauriBackend/`（开发）/ `dotnet-runtime/`（打包）

### 版本管理

- 版本号维护在两个位置：
  - `package.json` → `version` 字段（npm 版本）
  - `src-tauri/tauri.conf.json` → `version` 字段（Tauri 版本）
- `build-scripts/sync-version.js` 负责同步

---

## 13. 与上游 VRCX 的差异

| 方面 | VRCX (上游) | VRCX-Pro |
|------|-------------|----------|
| 桌面外壳 | Electron / CEF | Tauri 2 (Rust) |
| 前端框架 | Vue 3 (CDN) | Vue 3 + Vite + Pinia |
| 构建系统 | Electron Builder | Tauri CLI + Vite |
| 原生模块 | Node.js native | .NET Sidecar + Rust |
| MCP 集成 | 无 | 内置 MCP Server |
| UI 组件 | 自定义 | reka-ui + Tailwind CSS |
| 数据查询 | 手动管理 | TanStack Vue Query |
| 动画 | 简单 CSS | GSAP |

---

## 14. 常见问题

### Q: 如何开始开发？

```bash
npm install
npm run tauri:dev
```

需要安装 Rust 和 WebView2 (Windows)。

### Q: API 限流怎么办？

VRChat API 触发 429 后自动降速。可在 **设置 → 高级 → VRChat API 请求间隔下限保护** 调整等待秒数（默认 60s，硬性下限 30s）。

### Q: MCP Server 如何启用？

**设置 → 集成 → MCP Server → 开启 Enable MCP Server**。默认端口 3001，可通过设置修改。

### Q: 如何添加新的 VRChat API 调用？

1. 在 `src/api/` 对应模块中添加新函数
2. 使用 `request()` 发起请求
3. 如果是 Mutation，调用 `queryClient.invalidateQueries()` 清除缓存
4. 如需持久化，在对应 Store 中调用 API 并更新状态

### Q: 数据安全如何保障？

- 所有本地数据仅存储于本地 SQLite，不上传任何第三方
- 所有抓取信息均为 VRChat 公开 API 返回的公开信息
- MCP Server 仅监听本地回环地址，不暴露网络
- 本项目不包含也不支持批量抓取、自动刷等违规功能
