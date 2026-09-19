# MCP Server Support

VRCX-Pro 内置了 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 服务器，允许 AI 助手（如 Claude Desktop、Cursor、Windsurf 等）直接查询本地 VRCX 数据，实现更智能的 VRChat 社交管理体验。

---

## 目录

- [功能概览](#功能概览)
- [快速开始](#快速开始)
- [配置选项](#配置选项)
- [MCP 工具列表](#mcp-工具列表)
- [AI 客户端配置示例](#ai-客户端配置示例)
- [技术架构](#技术架构)
- [常见问题](#常见问题)

---

## 功能概览

MCP 服务器为 AI 助手提供了以下能力：

| 能力         | 说明                                                |
| ------------ | --------------------------------------------------- |
| 好友管理查询 | 获取好友列表、在线状态、信任等级、所在世界          |
| 活动追踪     | 查看好友近期活动：上下线、换模型、改签名、位置更改  |
| 统一 Feed    | 跨类型查询所有 feed 数据，支持按用户和类型过滤      |
| 收藏管理     | 查询好友收藏、世界收藏、模型收藏分组                |
| 自身信息     | 获取当前登录用户自己的档案数据（签名、模型、状态）  |
| 备忘录访问   | 读取本地存储的用户备忘录和世界备忘录                |
| 用户笔记     | 读取本地存储的用户笔记                              |
| 好友变更记录 | 查看好友添加/移除、改名、信任等级变更历史           |
| 游戏日志     | 获取位置记录、加入/离开、传送门生成、视频播放等日志 |
| 通知查询     | 查看 VRChat 邀请、好友请求等通知                    |
| 审核列表     | 查询屏蔽和静音的用户列表                            |
| 缓存搜索     | 按名称搜索本地缓存的世界和模型信息                  |
| 数据库探索   | 列出所有数据表及行数，了解数据结构                  |
| 社交分析洞察 | 预计算社交分析：活跃好友、在线时间分布、热门世界    |
| 好友在线规律 | 分析特定好友的在线时间模式和活跃规律                |
| 好友搜索     | 按名称、状态、信任等级、位置搜索好友                |
| 世界分析     | 世界访问统计、访问趋势、活跃访客排行                |
| 用户档案     | 综合用户画像：基础信息+最新状态+头像+备忘+近期活动 |
| 写入备忘     | 为用户设置或更新本地备注（写操作）                  |
| 共同位置发现 | 发现与特定用户在同一世界出现过的好友                |

---

## 快速开始

### 1. 启用 MCP 服务器

1. 打开 VRCX-Pro
2. 进入 **设置 → 集成**
3. 找到 **MCP Server** 分组
4. 开启 **Enable MCP Server** 开关
5. 服务器状态应显示为 **Running**（绿色）

### 2. 配置 AI 客户端

在 AI 客户端中添加 MCP 服务器配置（详见 [AI 客户端配置示例](#ai-客户端配置示例)）。

### 3. 开始对话

在 AI 助手中直接提问，例如：

- "我有哪些好友在线？"
- "最近谁换了模型？"
- "帮我搜索名字里带 'Japan' 的世界"
- "我的好友收藏分组有哪些？"
- "帮我分析一下最近一周的社交活跃情况"（vrcx_social_insights）
- "XX 通常什么时候在线？"（vrcx_get_friend_schedule）
- "哪些好友最近在 Japan 世界？"（vrcx_search_friends）
- "帮我给 XX 备注一下：喜欢动捕"（vrcx_set_note）
- "谁和我在同一个世界出现过？"（vrcx_get_co_location）"

---

## 配置选项

| 选项                  | 默认值   | 说明                                  |
| --------------------- | -------- | ------------------------------------- |
| **Enable MCP Server** | 关闭     | 启用/禁用 MCP 服务器                  |
| **Server Port**       | `3001`   | HTTP 监听端口（范围 1024–65535）      |
| **Server Status**     | —        | 显示当前运行状态（Running / Stopped） |
| **Database Path**     | 自动检测 | VRCX SQLite 数据库文件路径            |

### 数据库路径

默认情况下，MCP 服务器会尝试读取 VRCX 标准数据库位置：

- **Windows**: `%APPDATA%/VRCX/vrcx.db`

如果使用自定义路径，可在设置中手动指定。

---

## MCP 工具列表

### `vrcx_get_friends`

获取当前好友列表，包含在线状态、信任等级和好友编号。

```json
// 无参数
{}
```

**返回字段**: `user_id`, `display_name`, `trust_level`, `friend_number`

---

### `vrcx_get_friend_activity`

获取好友近期活动记录。

```json
{
    "type": "avatar",
    "limit": 20
}
```

**活动类型** (`type` 可选值):

- `gps` — 位置移动记录
- `status` — 状态变更（active / busy / join me 等）
- `avatar` — 模型更换记录
- `bio` — 签名变更记录
- `online_offline` — 上下线记录

---

### `vrcx_get_favorites`

获取收藏列表。

```json
{
    "type": "friend"
}
```

`type` 可选值: `friend` | `world` | `avatar`（留空返回全部，avatar 指 3D 模型收藏）

**返回结构**:

```json
{
  "friend": [...],
  "world": [...],
  "avatar": [...]
}
```

---

### `vrcx_get_memos`

获取所有本地备忘录（无参数）。

**返回结构**:

```json
{
  "user_memos": [...],
  "world_memos": [...]
}
```

---

### `vrcx_get_game_log`

获取游戏日志。

```json
{
    "type": "location",
    "limit": 50
}
```

`type` 可选值: `location` | `join_leave` | `portal_spawn` | `video_play`

---

### `vrcx_get_notifications`

获取 VRChat 通知列表。

```json
{
    "limit": 20
}
```

---

### `vrcx_get_moderation`

获取审核/屏蔽列表（无参数）。

**返回字段**: `user_id`, `updated_at`, `display_name`, `block`, `mute`

---

### `vrcx_get_cached_worlds`

搜索本地缓存的世界信息。

```json
{
    "search": "Japan",
    "limit": 20
}
```

---

### `vrcx_get_cached_avatars`

搜索本地缓存的模型信息。

```json
{
    "search": "cat",
    "limit": 20
}
```

---

### `vrcx_get_own_info`

获取当前登录用户自己的档案数据（从本地数据库读取，避免 VRChat API 限流）。

```json
// 无参数
{}
```

**返回字段**: `user_id`, `bio`（签名及变更记录）, `current_avatar`（当前模型）, `status`（在线状态）, `location`（当前位置）

---

### `vrcx_get_feed`

统一查询所有 feed 数据（GPS、状态、模型变更、签名、上下线），支持按类型和用户过滤。

```json
{
    "type": "bio",
    "user_id": "usr_xxx",
    "limit": 50
}
```

**参数**:

- `type`（可选）: `gps` | `status` | `avatar` | `bio` | `online_offline`
- `user_id`（可选）: 按用户 ID 过滤
- `limit`（可选）: 每类最大返回数（默认 50）

**返回**: 按时间倒序排列的 feed 数组，每条带 `_feed_type` 字段标记类型。

---

### `vrcx_get_notes`

获取本地存储的用户笔记。

```json
{
    "user_id": "usr_xxx",
    "search": "关键词",
    "limit": 50
}
```

**参数**（均可选）:

- `user_id`: 按用户 ID 过滤
- `search`: 按笔记内容关键词搜索
- `limit`: 最大返回数（默认 50）

---

### `vrcx_get_friend_log_history`

获取好友变更记录（添加/移除、改名、信任等级变更）。

```json
{
    "user_id": "usr_xxx",
    "limit": 50
}
```

**参数**（均可选）:

- `user_id`: 按用户 ID 过滤
- `limit`: 最大返回数（默认 50）

**返回字段**: `created_at`, `type`, `user_id`, `display_name`, `previous_display_name`, `trust_level`, `previous_trust_level`, `friend_number`

---

### `vrcx_list_tables`

列出数据库中所有表的名称和行数（无参数）。

**返回示例**:

```json
[
    { "name": "favorite_friend", "row_count": 42 },
    { "name": "memos", "row_count": 15 },
    { "name": "cache_world", "row_count": 1280 }
]
```

---


### `vrcx_social_insights`

获取预计算的社交分析数据：活跃好友排行、在线时间分布、最常访问的世界、模型更换频率等。适用于生成社交报告或回答关于好友活跃模式的问题。

```json
{
    "days": 7
}
```

**参数**（可选）:
- `days`: 分析周期天数（默认 7）

**返回字段**: `most_active_friends`, `online_hour_distribution`, `most_visited_worlds`, `most_avatar_changes`, `total_friends`

---

### `vrcx_get_friend_schedule`

获取特定好友的在线时间规律：通常几点在线、哪天最活跃、平均在线时长。

```json
{
    "user_id": "usr_xxx",
    "days": 14
}
```

**参数**:
- `user_id`（必填）: VRChat 用户 ID
- `days`（可选）: 分析周期天数（默认 14）

**返回字段**: `hourly_online_pattern`, `day_of_week_pattern`, `recent_online_events`

---

### `vrcx_search_friends`

按名称、状态、信任等级或位置搜索好友。

```json
{
    "query": "Japan",
    "status": "active",
    "trust_level": "trusted",
    "location_search": "Japan",
    "limit": 50
}
```

**参数**（均可选）:
- `query`: 名称关键词（模糊匹配）
- `status`: 在线状态过滤（`active` / `join me` / `ask me` / `busy` / `offline`）
- `trust_level`: 信任等级过滤
- `location_search`: 世界/位置名称搜索
- `limit`: 最大返回数（默认 50）

---

### `vrcx_get_world_analytics`

获取世界访问分析：最常访问的世界、每日访问趋势、活跃访客排行。

```json
{
    "days": 7,
    "limit": 20
}
```

**参数**（可选）:
- `days`: 分析周期天数（默认 7）
- `limit`: 最大返回世界数（默认 20）

**返回字段**: `most_visited_worlds`, `daily_visit_trend`, `most_active_visitors`

---

### `vrcx_get_user_profile`

获取指定用户的综合档案：基础信息、最新头像/状态/签名/位置、备忘录、笔记、近期活动统计和变更历史。

```json
{
    "user_id": "usr_xxx"
}
```

**参数**:
- `user_id`（必填）: VRChat 用户 ID

**返回字段**: `basic_info`, `current_avatar`, `current_status`, `current_bio`, `current_location`, `memo`, `note`, `recent_activity_7d`, `recent_history`

---

### `vrcx_set_note`

为用户设置或更新本地备注。这是**写操作**，会持久化到本地数据库。

```json
{
    "user_id": "usr_xxx",
    "note": "喜欢动捕，在 Japan 世界常驻"
}
```

**参数**:
- `user_id`（必填）: VRChat 用户 ID
- `note`（必填）: 备注内容

**返回**: `{ "success": true, "user_id": "usr_xxx", "message": "Note saved successfully" }`

---

### `vrcx_get_co_location`

发现与指定用户（或自己）在同一世界出现过的好友。用于发现社交关联和共同空间。

```json
{
    "user_id": "usr_xxx",
    "days": 7,
    "limit": 20
}
```

**参数**（均可选）:
- `user_id`: VRChat 用户 ID（留空则分析自己）
- `days`: 回溯天数（默认 7）
- `limit`: 最大返回数（默认 20）

**返回字段**: `display_name`, `user_id`, `world_name`, `shared_visits` / `co_visits`

---

## MCP Resources

MCP 服务器还提供了 Resource 端点，AI 客户端可以通过 `resources/list` 和 `resources/read` 获取服务器上下文信息：

| URI                        | 说明                     |
| -------------------------- | ------------------------ |
| `vrcx://schema/tables`     | 数据库所有表及行数       |
| `vrcx://context/server`    | 服务器版本和功能说明     |

---

## AI 客户端配置示例

### Claude Desktop

编辑 `claude_desktop_config.json`：

```json
{
    "mcpServers": {
        "vrcx-pro": {
            "url": "http://127.0.0.1:3001/mcp"
        }
    }
}
```

### Cursor / Windsurf

在 MCP 设置中添加 HTTP 类型的服务器：

- **Type**: HTTP
- **URL**: `http://127.0.0.1:3001/mcp`

### 通用 MCP 客户端

任何支持 MCP Streamable HTTP 传输的客户端均可连接：

| 参数       | 值                            |
| ---------- | ----------------------------- |
| 传输协议   | HTTP (Streamable HTTP)        |
| 端点       | `http://127.0.0.1:{port}/mcp` |
| 请求方式   | POST (JSON-RPC 2.0)           |
| 协议版本   | `2024-11-05`                  |
| 服务器名称 | `vrcx-pro-mcp`                |

---

## 技术架构

```
AI 客户端 (Claude Desktop / Cursor / ...)
    |
    |  HTTP POST /mcp (JSON-RPC 2.0)
    v
+-----------------------------------+
|  MCP Server (axum)                |
|  监听 127.0.0.1:{port}            |
|  +-- initialize                   |
|  +-- tools/list                   |
|  +-- tools/call                   |
|  +-- resources/list               |
|  +-- resources/read               |
|  +-- ping                         |
+----------------+------------------+
                 |
                 |  rusqlite (WAL 模式)
                 v
+-----------------------------------+
|  SQLite Database (vrcx.db)        |
|  +-- friend_log_current           |
|  +-- feed_* (GPS/状态/模型/签名)   |
|  +-- favorite_* (好友/世界/模型)   |
|  +-- memos / world_memos          |
|  +-- gamelog_*                    |
|  +-- notifications                |
|  +-- moderation                   |
|  +-- cache_world / cache_avatar   |
|  +-- ...                          |
+-----------------------------------+
```

### 关键技术选型

| 组件        | 技术                                                    | 说明                                   |
| ----------- | ------------------------------------------------------- | -------------------------------------- |
| HTTP 服务器 | [axum](https://github.com/tokio-rs/axum)                | 高性能 Rust HTTP 框架                  |
| 数据库访问  | [rusqlite](https://github.com/rusqlite/rusqlite)        | 直接读取 SQLite，无需依赖 .NET sidecar |
| 异步运行时  | [tokio](https://tokio.rs/)                              | Tauri 内置的异步运行时                 |
| SSE 流      | [async-stream](https://github.com/dtolnay/async-stream) | 用于 Server-Sent Events 推送           |
| 协议实现    | JSON-RPC 2.0                                            | MCP 标准协议                           |

### 安全设计

- **仅监听本地**: 服务器绑定 `127.0.0.1`，不暴露到网络
- **受限写入**: 仅 `vrcx_set_note` 可写入本地备注，其余均为只读查询
- **WAL 模式**: 使用 SQLite WAL 日志模式，支持与 .NET sidecar 并发读取
- **Busy Timeout**: 设置 5000ms 忙等待超时，避免数据库锁定错误
- **默认关闭**: MCP 服务器默认不启用，需用户主动开启

---

## 常见问题

### Q: MCP 服务器启动后端口被占用？

在设置中修改端口号（如 `3002`），然后重启 MCP 服务器。

### Q: 提示 "Database not found"？

确保 VRCX 数据库文件存在。默认路径为 `%APPDATA%/VRCX/vrcx.db`。如果使用自定义路径，在设置中手动指定。

### Q: AI 助手无法连接？

1. 确认 MCP 服务器状态显示 **Running**
2. 确认端口号配置正确
3. 检查是否有防火墙拦截本地连接
4. 尝试在浏览器中访问 `http://127.0.0.1:3001/mcp` 确认服务响应

### Q: 查询结果为空？

确保已登录 VRChat 且 VRCX 已经采集了数据。MCP 服务器读取的是 VRCX 本地数据库中的缓存数据。

### Q: 数据安全？

MCP 服务器：

- 主要为只读操作，仅 `vrcx_set_note` 会写入本地备注数据
- 不访问 VRChat API
- 仅监听本地回环地址
- 不存储或转发任何信息到第三方服务

### Q: AI 助手如何生成社交报告？

使用 `vrcx_social_insights` 工具获取预计算的社交分析数据，AI 助手可以自动生成包含活跃好友排行、在线时间分布、热门世界等信息的社交报告。也可以使用 `vrcx_get_world_analytics` 获取更详细的世界访问分析。

### Q: 如何用 AI 助手给好友添加备注？

使用 `vrcx_set_note` 工具，传入 `user_id` 和 `note` 参数即可。例如告诉 AI 助手："帮我给 XX 备注一下：喜欢动捕"，AI 会自动调用该工具保存备注。
