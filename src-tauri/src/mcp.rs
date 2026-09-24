use std::path::{Path, PathBuf};
use std::sync::Arc;

use axum::extract::{Json, State};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::IntoResponse;
use axum::routing::post;
use axum::Router;
use futures::Stream;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::sync::broadcast;

// ---------------------------------------------------------------------------
// MCP JSON-RPC types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub method: String,
    #[serde(default)]
    pub params: Option<Value>,
    #[serde(default)]
    pub id: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
}

impl JsonRpcError {
    fn method_not_found(method: &str) -> Self {
        Self {
            code: -32601,
            message: format!("Method not found: {method}"),
        }
    }
    fn invalid_params(msg: &str) -> Self {
        Self {
            code: -32602,
            message: msg.to_string(),
        }
    }
}

fn ok_response(result: Value, id: Option<Value>) -> JsonRpcResponse {
    JsonRpcResponse {
        jsonrpc: "2.0".into(),
        result: Some(result),
        error: None,
        id,
    }
}

fn err_response(err: JsonRpcError, id: Option<Value>) -> JsonRpcResponse {
    JsonRpcResponse {
        jsonrpc: "2.0".into(),
        result: None,
        error: Some(err),
        id,
    }
}

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct AppState {
    db_path: Arc<PathBuf>,
    tx: broadcast::Sender<Value>,
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

fn open_db(path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| format!("Failed to open database: {e}"))?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")
        .map_err(|e| format!("Failed to set PRAGMA: {e}"))?;
    Ok(conn)
}

fn query_to_json(path: &Path, sql: &str) -> Result<Value, String> {
    let conn = open_db(path)?;
    let mut stmt = conn.prepare(sql).map_err(|e| format!("SQL error: {e}"))?;
    let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let mut rows = stmt.query([]).map_err(|e| format!("SQL error: {e}"))?;
    let mut result: Vec<Value> = Vec::new();
    while let Some(row) = rows.next().map_err(|e| format!("SQL error: {e}"))? {
        let mut obj = serde_json::Map::new();
        for (i, col) in columns.iter().enumerate() {
            let value: Value = row
                .get::<_, Option<String>>(i)
                .unwrap_or(None)
                .map(Value::String)
                .or_else(|| row.get::<_, Option<i64>>(i).unwrap_or(None).map(|n| json!(n)))
                .or_else(|| row.get::<_, Option<f64>>(i).unwrap_or(None).map(|f| json!(f)))
                .unwrap_or(Value::Null);
            obj.insert(col.clone(), value);
        }
        result.push(Value::Object(obj));
    }
    Ok(Value::Array(result))
}

fn list_tables_with_count(path: &Path) -> Result<Value, String> {
    let conn = open_db(path)?;
    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .map_err(|e| e.to_string())?;
    let table_names: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    let mut tables_info = Vec::new();
    for name in &table_names {
        let count_sql = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = ?1";
        let count: i64 = conn.query_row(count_sql, [name.as_str()], |row| row.get(0)).unwrap_or(0);
        tables_info.push(json!({ "name": name, "row_count": count }));
    }
    Ok(json!(tables_info))
}

fn find_table(tables: &[String], suffix: &str) -> Option<String> {
    tables.iter().find(|t| t.ends_with(suffix)).cloned()
}

fn escape_sql_string(value: &str) -> String {
    value.replace('\'', "''")
}

fn execute_non_query(path: &Path, sql: &str) -> Result<(), String> {
    let conn = open_db(path)?;
    conn.execute(sql, []).map_err(|e| format!("SQL error: {e}"))?;
    Ok(())
}

fn query_single_value(path: &Path, sql: &str) -> Result<Value, String> {
    let conn = open_db(path)?;
    let result = conn
        .query_row(sql, [], |row| {
            let v: Value = row
                .get::<_, Option<String>>(0)
                .unwrap_or(None)
                .map(Value::String)
                .or_else(|| row.get::<_, Option<i64>>(0).unwrap_or(None).map(|n| json!(n)))
                .or_else(|| row.get::<_, Option<f64>>(0).unwrap_or(None).map(|f| json!(f)))
                .unwrap_or(Value::Null);
            Ok(v)
        })
        .unwrap_or(Value::Null);
    Ok(result)
}

fn get_user_tables(path: &Path) -> Result<Vec<String>, String> {
    let conn = open_db(path)?;
    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

// ---------------------------------------------------------------------------
// MCP tool definitions
// ---------------------------------------------------------------------------

fn mcp_tools() -> Vec<Value> {
    vec![
        json!({
            "name": "vrcx_get_friends",
            "description": "Get the current friends list with online status, display names, and trust levels.",
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "vrcx_get_friend_activity",
            "description": "Get recent friend activity (location changes, status changes, 3D model/avatar changes, bio changes, online/offline).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "type": { "type": "string", "enum": ["gps", "status", "avatar", "bio", "online_offline"], "description": "Filter by activity type" },
                    "limit": { "type": "integer", "description": "Max results (default 20)" }
                }
            }
        }),
        json!({
            "name": "vrcx_get_favorites",
            "description": "Get favorite friends, worlds, and 3D models (avatars).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "type": { "type": "string", "enum": ["friend", "world", "avatar"], "description": "Filter by favorite type" }
                }
            }
        }),
        json!({
            "name": "vrcx_get_memos",
            "description": "Get all user memos and world memos stored locally.",
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "vrcx_get_game_log",
            "description": "Get recent game log entries (location, join/leave, portal spawn, video play).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "type": { "type": "string", "enum": ["location", "join_leave", "portal_spawn", "video_play"], "description": "Filter by log type" },
                    "limit": { "type": "integer", "description": "Max results (default 50)" }
                }
            }
        }),
        json!({
            "name": "vrcx_get_notifications",
            "description": "Get recent VRChat notifications (invites, friend requests, etc.).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "limit": { "type": "integer", "description": "Max results (default 20)" }
                }
            }
        }),
        json!({
            "name": "vrcx_get_moderation",
            "description": "Get the moderation list (blocked and muted users).",
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "vrcx_get_cached_worlds",
            "description": "Search locally cached VRChat world information by name.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "search": { "type": "string", "description": "World name keyword (fuzzy match)" },
                    "limit": { "type": "integer", "description": "Max results (default 20)" }
                }
            }
        }),
        json!({
            "name": "vrcx_get_cached_avatars",
            "description": "Search locally cached VRChat 3D model (avatar) information by name.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "search": { "type": "string", "description": "3D model (avatar) name keyword (fuzzy match)" },
                    "limit": { "type": "integer", "description": "Max results (default 20)" }
                }
            }
        }),
        json!({
            "name": "vrcx_list_tables",
            "description": "List all database tables with row counts to understand the current schema.",
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "vrcx_get_own_info",
            "description": "Get the current logged-in user's own profile data from local database (bio, avatar/model, status, location). Reads from feed tables to avoid VRChat API rate limits.",
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "vrcx_get_feed",
            "description": "Get unified feed data across all feed types (GPS, status, avatar/model change, bio, online/offline). Supports filtering by type and user_id.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "type": { "type": "string", "enum": ["gps", "status", "avatar", "bio", "online_offline"], "description": "Filter by feed type" },
                    "user_id": { "type": "string", "description": "Filter by specific user ID" },
                    "limit": { "type": "integer", "description": "Max results per type (default 50)" }
                }
            }
        }),
        json!({
            "name": "vrcx_get_notes",
            "description": "Get locally stored user notes.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "user_id": { "type": "string", "description": "Filter by specific user ID" },
                    "search": { "type": "string", "description": "Search notes by content keyword" },
                    "limit": { "type": "integer", "description": "Max results (default 50)" }
                }
            }
        }),
        json!({
            "name": "vrcx_get_friend_log_history",
            "description": "Get friend log history (friend add/remove, name changes, trust level changes).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "user_id": { "type": "string", "description": "Filter by specific user ID" },
                    "limit": { "type": "integer", "description": "Max results (default 50)" }
                }
            }
        }),
        json!({
            "name": "vrcx_social_insights",
            "description": "Get pre-computed social analytics: most active friends, online time patterns, most visited worlds, and avatar change stats.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "days": { "type": "integer", "description": "Analysis period in days (default 7)" }
                }
            }
        }),
        json!({
            "name": "vrcx_get_friend_schedule",
            "description": "Get the online schedule pattern for a specific friend: which hours they are typically online, which days are most active.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "user_id": { "type": "string", "description": "VRChat user ID to analyze" },
                    "days": { "type": "integer", "description": "Analysis period in days (default 14)" }
                },
                "required": ["user_id"]
            }
        }),
        json!({
            "name": "vrcx_search_friends",
            "description": "Search friends by name, status, trust level, or current location.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Search keyword (matches display name)" },
                    "status": { "type": "string", "enum": ["active", "join me", "ask me", "busy", "offline"], "description": "Filter by online status" },
                    "trust_level": { "type": "string", "description": "Filter by trust level" },
                    "location_search": { "type": "string", "description": "Search by world/location name" },
                    "limit": { "type": "integer", "description": "Max results (default 50)" }
                }
            }
        }),
        json!({
            "name": "vrcx_get_world_analytics",
            "description": "Get world visit analytics: most visited worlds, visit frequency, and time spent.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "days": { "type": "integer", "description": "Analysis period in days (default 7)" },
                    "limit": { "type": "integer", "description": "Max worlds to return (default 20)" }
                }
            }
        }),
        json!({
            "name": "vrcx_get_user_profile",
            "description": "Get a comprehensive profile for a specific user: basic info, latest location/status/bio, avatar, memos, notes, and recent activity.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "user_id": { "type": "string", "description": "VRChat user ID" }
                },
                "required": ["user_id"]
            }
        }),
        json!({
            "name": "vrcx_set_note",
            "description": "Set or update a local note/memo for a user. Write operation that persists to the local database.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "user_id": { "type": "string", "description": "VRChat user ID" },
                    "note": { "type": "string", "description": "Note content to save" }
                },
                "required": ["user_id", "note"]
            }
        }),
        json!({
            "name": "vrcx_get_co_location",
            "description": "Find friends who have been in the same world/instance as the specified user (or yourself).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "user_id": { "type": "string", "description": "VRChat user ID to check (leave empty for yourself)" },
                    "days": { "type": "integer", "description": "Look back period in days (default 7)" },
                    "limit": { "type": "integer", "description": "Max results (default 20)" }
                }
            }
        }),
    ]
}

// ---------------------------------------------------------------------------
// Tool call dispatcher
// ---------------------------------------------------------------------------

fn handle_tool_call(name: &str, args: &Value, db_path: &Path) -> Result<Value, String> {
    match name {
        "vrcx_get_friends" => {
            let tables = get_user_tables(db_path)?;
            let tbl = find_table(&tables, "_friend_log_current")
                .ok_or("friend_log_current table not found")?;
            query_to_json(db_path, &format!("SELECT * FROM \"{tbl}\" ORDER BY friend_number ASC"))
        }
        "vrcx_get_friend_activity" => {
            let tables = get_user_tables(db_path)?;
            let activity_type = args.get("type").and_then(|v| v.as_str()).unwrap_or("");
            let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);
            let mut results: Vec<Value> = Vec::new();
            let feed_tables = [
                ("gps", "_feed_gps"),
                ("status", "_feed_status"),
                ("avatar", "_feed_avatar"),
                ("bio", "_feed_bio"),
                ("online_offline", "_feed_online_offline"),
            ];
            for (key, suffix) in feed_tables {
                if !activity_type.is_empty() && activity_type != key {
                    continue;
                }
                if let Some(tbl) = tables.iter().find(|t| t.ends_with(suffix)) {
                    let sql = format!("SELECT * FROM \"{tbl}\" ORDER BY rowid DESC LIMIT {limit}");
                    if let Ok(data) = query_to_json(db_path, &sql) {
                        if let Some(arr) = data.as_array() {
                            for item in arr {
                                let mut obj = item.clone();
                                if let Some(o) = obj.as_object_mut() {
                                    o.insert("_feed_type".into(), json!(key));
                                }
                                results.push(obj);
                            }
                        }
                    }
                }
            }
            Ok(json!(results))
        }
        "vrcx_get_favorites" => {
            let fav_type = args.get("type").and_then(|v| v.as_str()).unwrap_or("");
            let mut result = serde_json::Map::new();
            if fav_type.is_empty() || fav_type == "friend" {
                if let Ok(data) = query_to_json(db_path, "SELECT * FROM favorite_friend") {
                    result.insert("friend".into(), data);
                }
            }
            if fav_type.is_empty() || fav_type == "world" {
                if let Ok(data) = query_to_json(db_path, "SELECT * FROM favorite_world") {
                    result.insert("world".into(), data);
                }
            }
            if fav_type.is_empty() || fav_type == "avatar" {
                if let Ok(data) = query_to_json(db_path, "SELECT * FROM favorite_avatar") {
                    result.insert("avatar".into(), data);
                }
            }
            Ok(Value::Object(result))
        }
        "vrcx_get_memos" => {
            let mut result = serde_json::Map::new();
            if let Ok(data) = query_to_json(db_path, "SELECT * FROM memos") {
                result.insert("user_memos".into(), data);
            }
            if let Ok(data) = query_to_json(db_path, "SELECT * FROM world_memos") {
                result.insert("world_memos".into(), data);
            }
            Ok(Value::Object(result))
        }
        "vrcx_get_game_log" => {
            let log_type = args.get("type").and_then(|v| v.as_str()).unwrap_or("");
            let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(50);
            let mut result = serde_json::Map::new();
            let log_tables = [
                ("location", "gamelog_location"),
                ("join_leave", "gamelog_join_leave"),
                ("portal_spawn", "gamelog_portal_spawn"),
                ("video_play", "gamelog_video_play"),
            ];
            for (key, tbl) in log_tables {
                if !log_type.is_empty() && log_type != key {
                    continue;
                }
                let sql = format!("SELECT * FROM \"{tbl}\" ORDER BY rowid DESC LIMIT {limit}");
                if let Ok(data) = query_to_json(db_path, &sql) {
                    result.insert(key.into(), data);
                }
            }
            Ok(Value::Object(result))
        }
        "vrcx_get_notifications" => {
            let tables = get_user_tables(db_path)?;
            let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_notifications")) {
                let sql = format!("SELECT * FROM \"{tbl}\" ORDER BY rowid DESC LIMIT {limit}");
                query_to_json(db_path, &sql)
            } else {
                Ok(json!([]))
            }
        }
        "vrcx_get_moderation" => {
            let tables = get_user_tables(db_path)?;
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_moderation")) {
                query_to_json(db_path, &format!("SELECT * FROM \"{tbl}\""))
            } else {
                Ok(json!([]))
            }
        }
        "vrcx_get_cached_worlds" => {
            let search = args.get("search").and_then(|v| v.as_str()).unwrap_or("");
            let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);
            let sql = if search.is_empty() {
                format!("SELECT * FROM cache_world ORDER BY rowid DESC LIMIT {limit}")
            } else {
                let escaped = search.replace('\'', "''");
                format!("SELECT * FROM cache_world WHERE name LIKE '%{escaped}%' ORDER BY rowid DESC LIMIT {limit}")
            };
            query_to_json(db_path, &sql)
        }
        "vrcx_get_cached_avatars" => {
            let search = args.get("search").and_then(|v| v.as_str()).unwrap_or("");
            let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);
            let sql = if search.is_empty() {
                format!("SELECT * FROM cache_avatar ORDER BY rowid DESC LIMIT {limit}")
            } else {
                let escaped = search.replace('\'', "''");
                format!("SELECT * FROM cache_avatar WHERE name LIKE '%{escaped}%' ORDER BY rowid DESC LIMIT {limit}")
            };
            query_to_json(db_path, &sql)
        }
        "vrcx_list_tables" => list_tables_with_count(db_path),
        "vrcx_get_own_info" => {
            let tables = get_user_tables(db_path)?;
            // Find the current user ID from activity_sync_state_v2
            let own_user_id = if let Some(tbl) = tables.iter().find(|t| t.ends_with("_activity_sync_state_v2")) {
                let sql = format!("SELECT user_id FROM \"{tbl}\" WHERE is_self = 1 LIMIT 1");
                let conn = open_db(db_path)?;
                conn.query_row(&sql, [], |row| row.get::<_, String>(0)).ok()
            } else {
                None
            };
            let user_id = own_user_id.ok_or("Current user not found in activity_sync_state_v2")?;
            let mut result = serde_json::Map::new();
            result.insert("user_id".into(), json!(user_id));
            // Latest bio
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_bio")) {
                let sql = format!("SELECT bio, previous_bio, created_at FROM \"{tbl}\" WHERE user_id = '{user_id}' ORDER BY id DESC LIMIT 1");
                if let Ok(data) = query_to_json(db_path, &sql) {
                    if let Some(arr) = data.as_array() {
                        if let Some(first) = arr.first() {
                            result.insert("bio".into(), first.clone());
                        }
                    }
                }
            }
            // Latest avatar/model
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_avatar")) {
                let sql = format!("SELECT avatar_name, owner_id, created_at FROM \"{tbl}\" WHERE user_id = '{user_id}' ORDER BY id DESC LIMIT 1");
                if let Ok(data) = query_to_json(db_path, &sql) {
                    if let Some(arr) = data.as_array() {
                        if let Some(first) = arr.first() {
                            result.insert("current_avatar".into(), first.clone());
                        }
                    }
                }
            }
            // Latest status
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_status")) {
                let sql = format!("SELECT status, status_description, created_at FROM \"{tbl}\" WHERE user_id = '{user_id}' ORDER BY id DESC LIMIT 1");
                if let Ok(data) = query_to_json(db_path, &sql) {
                    if let Some(arr) = data.as_array() {
                        if let Some(first) = arr.first() {
                            result.insert("status".into(), first.clone());
                        }
                    }
                }
            }
            // Latest location
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_gps")) {
                let sql = format!("SELECT location, world_name, created_at FROM \"{tbl}\" WHERE user_id = '{user_id}' ORDER BY id DESC LIMIT 1");
                if let Ok(data) = query_to_json(db_path, &sql) {
                    if let Some(arr) = data.as_array() {
                        if let Some(first) = arr.first() {
                            result.insert("location".into(), first.clone());
                        }
                    }
                }
            }
            Ok(Value::Object(result))
        }
        "vrcx_get_feed" => {
            let tables = get_user_tables(db_path)?;
            let activity_type = args.get("type").and_then(|v| v.as_str()).unwrap_or("");
            let filter_user_id = args.get("user_id").and_then(|v| v.as_str()).unwrap_or("");
            let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(50);
            let mut results: Vec<Value> = Vec::new();
            let feed_tables = [
                ("gps", "_feed_gps"),
                ("status", "_feed_status"),
                ("avatar", "_feed_avatar"),
                ("bio", "_feed_bio"),
                ("online_offline", "_feed_online_offline"),
            ];
            for (key, suffix) in feed_tables {
                if !activity_type.is_empty() && activity_type != key {
                    continue;
                }
                if let Some(tbl) = tables.iter().find(|t| t.ends_with(suffix)) {
                    let where_clause = if filter_user_id.is_empty() {
                        String::new()
                    } else {
                        let escaped = filter_user_id.replace('\'', "''");
                        format!(" WHERE user_id = '{escaped}'")
                    };
                    let sql = format!("SELECT * FROM \"{tbl}\"{where_clause} ORDER BY rowid DESC LIMIT {limit}");
                    if let Ok(data) = query_to_json(db_path, &sql) {
                        if let Some(arr) = data.as_array() {
                            for item in arr {
                                let mut obj = item.clone();
                                if let Some(o) = obj.as_object_mut() {
                                    o.insert("_feed_type".into(), json!(key));
                                }
                                results.push(obj);
                            }
                        }
                    }
                }
            }
            // Sort all results by created_at descending
            results.sort_by(|a, b| {
                let ca = a.get("created_at").and_then(|v| v.as_str()).unwrap_or("");
                let cb = b.get("created_at").and_then(|v| v.as_str()).unwrap_or("");
                cb.cmp(ca)
            });
            // Apply global limit
            results.truncate(limit as usize);
            Ok(json!(results))
        }
        "vrcx_get_notes" => {
            let tables = get_user_tables(db_path)?;
            let filter_user_id = args.get("user_id").and_then(|v| v.as_str()).unwrap_or("");
            let search = args.get("search").and_then(|v| v.as_str()).unwrap_or("");
            let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(50);
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_notes")) {
                let mut conditions = Vec::new();
                if !filter_user_id.is_empty() {
                    let escaped = filter_user_id.replace('\'', "''");
                    conditions.push(format!("user_id = '{escaped}'"));
                }
                if !search.is_empty() {
                    let escaped = search.replace('\'', "''");
                    conditions.push(format!("note LIKE '%{escaped}%'"));
                }
                let where_clause = if conditions.is_empty() {
                    String::new()
                } else {
                    format!(" WHERE {}", conditions.join(" AND "))
                };
                let sql = format!("SELECT * FROM \"{tbl}\"{where_clause} ORDER BY rowid DESC LIMIT {limit}");
                query_to_json(db_path, &sql)
            } else {
                Ok(json!([]))
            }
        }
        "vrcx_get_friend_log_history" => {
            let tables = get_user_tables(db_path)?;
            let filter_user_id = args.get("user_id").and_then(|v| v.as_str()).unwrap_or("");
            let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(50);
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_friend_log_history")) {
                let where_clause = if filter_user_id.is_empty() {
                    String::new()
                } else {
                    let escaped = filter_user_id.replace('\'', "''");
                    format!(" WHERE user_id = '{escaped}'")
                };
                let sql = format!("SELECT * FROM \"{tbl}\"{where_clause} ORDER BY rowid DESC LIMIT {limit}");
                query_to_json(db_path, &sql)
            } else {
                Ok(json!([]))
            }
        }
        "vrcx_social_insights" => {
            let tables = get_user_tables(db_path)?;
            let days = args.get("days").and_then(|v| v.as_i64()).unwrap_or(7);
            let cutoff = format!("-{days} days");
            let mut insights = serde_json::Map::new();
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_gps")) {
                let sql = format!("SELECT display_name, user_id, COUNT(*) as visit_count FROM \"{}\" WHERE created_at >= datetime(\"now\", \"{}\") GROUP BY user_id ORDER BY visit_count DESC LIMIT 10", tbl, cutoff);
                if let Ok(data) = query_to_json(db_path, &sql) { insights.insert("most_active_friends".into(), data); }
            }
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_online_offline")) {
                let sql = format!("SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count FROM \"{tbl}\" WHERE LOWER(type) = 'online' AND created_at >= datetime('now', '{cutoff}') GROUP BY hour ORDER BY hour");
                insights.insert("online_hour_distribution".into(), query_to_json(db_path, &sql)?);
            }
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_gps")) {
                let sql = format!("SELECT world_name, COUNT(*) as visits FROM \"{}\" WHERE created_at >= datetime(\"now\", \"{}\") AND world_name IS NOT NULL AND world_name != \"\" GROUP BY world_name ORDER BY visits DESC LIMIT 10", tbl, cutoff);
                if let Ok(data) = query_to_json(db_path, &sql) { insights.insert("most_visited_worlds".into(), data); }
            }
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_avatar")) {
                let sql = format!("SELECT display_name, user_id, COUNT(*) as changes FROM \"{}\" WHERE created_at >= datetime(\"now\", \"{}\") GROUP BY user_id ORDER BY changes DESC LIMIT 10", tbl, cutoff);
                if let Ok(data) = query_to_json(db_path, &sql) { insights.insert("most_avatar_changes".into(), data); }
            }
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_friend_log_current")) {
                let sql = format!("SELECT COUNT(*) FROM \"{}\"", tbl);
                if let Ok(data) = query_single_value(db_path, &sql) { insights.insert("total_friends".into(), data); }
            }
            insights.insert("analysis_period_days".into(), json!(days));
            Ok(Value::Object(insights))
        }
        "vrcx_get_friend_schedule" => {
            let tables = get_user_tables(db_path)?;
            let user_id = args.get("user_id").and_then(|v| v.as_str()).ok_or("Missing required parameter: user_id")?;
            let days = args.get("days").and_then(|v| v.as_i64()).unwrap_or(14);
            let cutoff = format!("-{days} days");
            let escaped = escape_sql_string(user_id);
            let mut schedule = serde_json::Map::new();
            schedule.insert("user_id".into(), json!(user_id));
            schedule.insert("analysis_period_days".into(), json!(days));
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_online_offline")) {
                let hourly_sql = format!("SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as online_count FROM \"{tbl}\" WHERE user_id = '{escaped}' AND LOWER(type) = 'online' AND created_at >= datetime('now', '{cutoff}') GROUP BY hour ORDER BY hour");
                let weekday_sql = format!("SELECT CAST(strftime('%w', created_at) AS INTEGER) as day_of_week, COUNT(*) as count FROM \"{tbl}\" WHERE user_id = '{escaped}' AND LOWER(type) = 'online' AND created_at >= datetime('now', '{cutoff}') GROUP BY day_of_week ORDER BY day_of_week");
                let events_sql = format!("SELECT type, created_at FROM \"{tbl}\" WHERE user_id = '{escaped}' AND created_at >= datetime('now', '{cutoff}') ORDER BY id DESC LIMIT 100");
                schedule.insert("hourly_online_pattern".into(), query_to_json(db_path, &hourly_sql)?);
                schedule.insert("day_of_week_pattern".into(), query_to_json(db_path, &weekday_sql)?);
                schedule.insert("recent_online_events".into(), query_to_json(db_path, &events_sql)?);
            } else {
                schedule.insert("hourly_online_pattern".into(), json!([]));
                schedule.insert("day_of_week_pattern".into(), json!([]));
                schedule.insert("recent_online_events".into(), json!([]));
            }
            Ok(Value::Object(schedule))
        }
        "vrcx_search_friends" => {
            let tables = get_user_tables(db_path)?;
            let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("");
            let status_filter = args.get("status").and_then(|v| v.as_str()).unwrap_or("");
            let trust_filter = args.get("trust_level").and_then(|v| v.as_str()).unwrap_or("");
            let location_filter = args.get("location_search").and_then(|v| v.as_str()).unwrap_or("");
            let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(50);
            let tbl = find_table(&tables, "_friend_log_current").ok_or("friend_log_current table not found")?;
            let mut conditions = Vec::new();
            if !query.is_empty() {
                let q = escape_sql_string(query);
                conditions.push(format!("display_name LIKE '%{}%'", q));
            }
            if !trust_filter.is_empty() {
                let t = escape_sql_string(trust_filter);
                conditions.push(format!("trust_level = '{}'", t));
            }
            let where_clause = if conditions.is_empty() { String::new() } else { format!(" WHERE {}", conditions.join(" AND ")) };
            let sql = format!("SELECT * FROM \"{}\"{} ORDER BY friend_number ASC", tbl, where_clause);
            let mut results = query_to_json(db_path, &sql)?;
            if !status_filter.is_empty() {
                let status_table = tables.iter().find(|t| t.ends_with("_feed_status")).ok_or("feed_status table not found")?;
                let presence_table = tables.iter().find(|t| t.ends_with("_feed_online_offline")).ok_or("feed_online_offline table not found")?;
                let status_sql = format!("SELECT user_id, status FROM (SELECT user_id, status, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY id DESC) AS row_number FROM \"{status_table}\") WHERE row_number = 1");
                let presence_sql = format!("SELECT user_id, type FROM (SELECT user_id, type, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY id DESC) AS row_number FROM \"{presence_table}\") WHERE row_number = 1");
                let current_statuses = query_to_json(db_path, &status_sql)?;
                let current_presences = query_to_json(db_path, &presence_sql)?;
                let status_by_user = current_statuses.as_array().map(|rows| rows.iter().filter_map(|row| Some((row.get("user_id")?.as_str()?.to_string(), row.get("status")?.as_str()?.to_lowercase()))).collect::<std::collections::HashMap<_, _>>()).unwrap_or_default();
                let presence_by_user = current_presences.as_array().map(|rows| rows.iter().filter_map(|row| Some((row.get("user_id")?.as_str()?.to_string(), row.get("type")?.as_str()?.to_lowercase()))).collect::<std::collections::HashMap<_, _>>()).unwrap_or_default();
                let requested_status = status_filter.trim().to_lowercase();
                if let Some(rows) = results.as_array_mut() {
                    rows.retain(|item| {
                        let Some(user_id) = item.get("user_id").and_then(|value| value.as_str()) else { return false; };
                        let status = status_by_user.get(user_id).map(String::as_str).unwrap_or("");
                        let presence = presence_by_user.get(user_id).map(String::as_str).unwrap_or("offline");
                        if requested_status == "offline" {
                            status == "offline" || presence != "online"
                        } else {
                            presence == "online" && status == requested_status
                        }
                    });
                }
            }
            if !location_filter.is_empty() {
                let loc = escape_sql_string(location_filter);
                if let Some(gt) = tables.iter().find(|t| t.ends_with("_feed_gps")) {
                    let sql = format!("SELECT DISTINCT user_id FROM \"{}\" WHERE (world_name LIKE '%{}%' OR location LIKE '%{}%') AND created_at >= datetime(\"now\", \"-24 hours\")", gt, loc, loc);
                    if let Ok(lu) = query_to_json(db_path, &sql) {
                        if let Some(arr) = lu.as_array() {
                            let ids: std::collections::HashSet<String> = arr.iter().filter_map(|v| v.get("user_id").and_then(|u| u.as_str()).map(String::from)).collect();
                            if let Some(r) = results.as_array_mut() { r.retain(|item| item.get("user_id").and_then(|u| u.as_str()).map(|id| ids.contains(id)).unwrap_or(false)); }
                        }
                    }
                }
            }
            if let Some(rows) = results.as_array_mut() {
                rows.truncate(usize::try_from(limit).unwrap_or(0));
            }
            Ok(results)
        }
        "vrcx_get_world_analytics" => {
            let tables = get_user_tables(db_path)?;
            let days = args.get("days").and_then(|v| v.as_i64()).unwrap_or(7);
            let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);
            let cutoff = format!("-{days} days");
            let mut analytics = serde_json::Map::new();
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_gps")) {
                let sql = format!("SELECT world_name, location, COUNT(*) as visits, MIN(created_at) as first_visit, MAX(created_at) as last_visit FROM \"{}\" WHERE created_at >= datetime(\"now\", \"{}\") AND world_name IS NOT NULL AND world_name != \"\" GROUP BY world_name ORDER BY visits DESC LIMIT {}", tbl, cutoff, limit);
                if let Ok(data) = query_to_json(db_path, &sql) { analytics.insert("most_visited_worlds".into(), data); }
            }
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_gps")) {
                let sql = format!("SELECT DATE(created_at) as date, COUNT(*) as visits, COUNT(DISTINCT world_name) as unique_worlds FROM \"{}\" WHERE created_at >= datetime(\"now\", \"{}\") GROUP BY date ORDER BY date", tbl, cutoff);
                if let Ok(data) = query_to_json(db_path, &sql) { analytics.insert("daily_visit_trend".into(), data); }
            }
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_gps")) {
                let sql = format!("SELECT display_name, user_id, COUNT(DISTINCT world_name) as unique_worlds, COUNT(*) as total_visits FROM \"{}\" WHERE created_at >= datetime(\"now\", \"{}\") GROUP BY user_id ORDER BY total_visits DESC LIMIT 10", tbl, cutoff);
                if let Ok(data) = query_to_json(db_path, &sql) { analytics.insert("most_active_visitors".into(), data); }
            }
            analytics.insert("analysis_period_days".into(), json!(days));
            Ok(Value::Object(analytics))
        }
        "vrcx_get_user_profile" => {
            let tables = get_user_tables(db_path)?;
            let user_id = args.get("user_id").and_then(|v| v.as_str()).ok_or("Missing required parameter: user_id")?;
            let escaped = escape_sql_string(user_id);
            let mut profile = serde_json::Map::new();
            profile.insert("user_id".into(), json!(user_id));
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_friend_log_current")) {
                let sql = format!("SELECT * FROM \"{}\" WHERE user_id = '{}'", tbl, escaped);
                if let Ok(data) = query_to_json(db_path, &sql) {
                    if let Some(arr) = data.as_array() { if let Some(first) = arr.first() { profile.insert("basic_info".into(), first.clone()); } }
                }
            }
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_avatar")) {
                let sql = format!("SELECT avatar_name, current_avatar_image_url, current_avatar_thumbnail_image_url, created_at FROM \"{}\" WHERE user_id = '{}' ORDER BY id DESC LIMIT 1", tbl, escaped);
                if let Ok(data) = query_to_json(db_path, &sql) {
                    if let Some(arr) = data.as_array() { if let Some(first) = arr.first() { profile.insert("current_avatar".into(), first.clone()); } }
                }
            }
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_status")) {
                let sql = format!("SELECT status, status_description, created_at FROM \"{}\" WHERE user_id = '{}' ORDER BY id DESC LIMIT 1", tbl, escaped);
                if let Ok(data) = query_to_json(db_path, &sql) {
                    if let Some(arr) = data.as_array() { if let Some(first) = arr.first() { profile.insert("current_status".into(), first.clone()); } }
                }
            }
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_bio")) {
                let sql = format!("SELECT bio, created_at FROM \"{}\" WHERE user_id = '{}' ORDER BY id DESC LIMIT 1", tbl, escaped);
                if let Ok(data) = query_to_json(db_path, &sql) {
                    if let Some(arr) = data.as_array() { if let Some(first) = arr.first() { profile.insert("current_bio".into(), first.clone()); } }
                }
            }
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_feed_gps")) {
                let sql = format!("SELECT location, world_name, created_at FROM \"{}\" WHERE user_id = '{}' ORDER BY id DESC LIMIT 1", tbl, escaped);
                if let Ok(data) = query_to_json(db_path, &sql) {
                    if let Some(arr) = data.as_array() { if let Some(first) = arr.first() { profile.insert("current_location".into(), first.clone()); } }
                }
            }
            if let Ok(data) = query_to_json(db_path, &format!("SELECT memo FROM memos WHERE user_id = '{}'", escaped)) {
                if let Some(arr) = data.as_array() { if let Some(first) = arr.first() { profile.insert("memo".into(), first.clone()); } }
            }
            if let Ok(data) = query_to_json(db_path, &format!("SELECT note FROM notes WHERE user_id = '{}'", escaped)) {
                if let Some(arr) = data.as_array() { if let Some(first) = arr.first() { profile.insert("note".into(), first.clone()); } }
            }
            let activity_types = [("_feed_gps", "location_changes"), ("_feed_status", "status_changes"), ("_feed_avatar", "avatar_changes")];
            let mut recent_activity = serde_json::Map::new();
            for (suffix, key) in &activity_types {
                if let Some(tbl) = tables.iter().find(|t| t.ends_with(suffix)) {
                    let sql = format!("SELECT COUNT(*) FROM \"{}\" WHERE user_id = '{}' AND created_at >= datetime(\"now\", \"-7 days\")", tbl, escaped);
                    if let Ok(data) = query_single_value(db_path, &sql) { recent_activity.insert(key.to_string(), data); }
                }
            }
            profile.insert("recent_activity_7d".into(), Value::Object(recent_activity));
            if let Some(tbl) = tables.iter().find(|t| t.ends_with("_friend_log_history")) {
                let sql = format!("SELECT * FROM \"{}\" WHERE user_id = '{}' ORDER BY rowid DESC LIMIT 10", tbl, escaped);
                if let Ok(data) = query_to_json(db_path, &sql) { profile.insert("recent_history".into(), data); }
            }
            Ok(Value::Object(profile))
        }
        "vrcx_set_note" => {
            let user_id = args.get("user_id").and_then(|v| v.as_str()).ok_or("Missing required parameter: user_id")?;
            let note = args.get("note").and_then(|v| v.as_str()).ok_or("Missing required parameter: note")?;
            let escaped_uid = escape_sql_string(user_id);
            let escaped_note = escape_sql_string(note);
            let sql = format!("INSERT OR REPLACE INTO notes (user_id, note) VALUES ('{}', '{}')", escaped_uid, escaped_note);
            execute_non_query(db_path, &sql)?;
            Ok(json!({ "success": true, "user_id": user_id, "message": "Note saved successfully" }))
        }
        "vrcx_get_co_location" => {
            let tables = get_user_tables(db_path)?;
            let user_id = args.get("user_id").and_then(|v| v.as_str()).unwrap_or("");
            let days = args.get("days").and_then(|v| v.as_i64()).unwrap_or(7);
            let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);
            let cutoff = format!("-{days} days");
            let gps_tbl = tables.iter().find(|t| t.ends_with("_feed_gps")).ok_or("feed_gps table not found")?;
            if user_id.is_empty() {
                let sql = format!("SELECT display_name, user_id, world_name, COUNT(*) as shared_visits FROM \"{}\" WHERE world_name IN (SELECT world_name FROM \"{}\" WHERE created_at >= datetime(\"now\", \"{}\") AND world_name IS NOT NULL AND world_name != \"\" GROUP BY world_name HAVING COUNT(*) > 1) AND created_at >= datetime(\"now\", \"{}\") GROUP BY user_id, world_name ORDER BY shared_visits DESC LIMIT {}", gps_tbl, gps_tbl, cutoff, cutoff, limit);
                query_to_json(db_path, &sql)
            } else {
                let escaped = escape_sql_string(user_id);
                let sql = format!("SELECT g2.display_name, g2.user_id, g1.world_name, COUNT(*) as co_visits FROM \"{}\" g1 JOIN \"{}\" g2 ON g1.world_name = g2.world_name AND g1.user_id != g2.user_id WHERE g1.user_id = '{}' AND g1.created_at >= datetime(\"now\", \"{}\") AND g2.created_at >= datetime(\"now\", \"{}\") AND g1.world_name IS NOT NULL AND g1.world_name != \"\" GROUP BY g2.user_id, g1.world_name ORDER BY co_visits DESC LIMIT {}", gps_tbl, gps_tbl, escaped, cutoff, cutoff, limit);
                query_to_json(db_path, &sql)
            }
        }
        _ => Err(format!("Unknown tool: {name}")),
    }
}

// ---------------------------------------------------------------------------
// MCP protocol handler
// ---------------------------------------------------------------------------

fn handle_mcp_message(request: &JsonRpcRequest, state: &AppState) -> JsonRpcResponse {
    match request.method.as_str() {
        "initialize" => ok_response(
            json!({
                "protocolVersion": "2024-11-05",
                "capabilities": { "tools": { "listChanged": false }, "resources": { "listChanged": false } },
                "serverInfo": { "name": "vrcx-pro-mcp", "version": env!("CARGO_PKG_VERSION") }
            }),
            request.id.clone(),
        ),
        "notifications/initialized" => ok_response(json!(null), None),
        "tools/list" => ok_response(json!({ "tools": mcp_tools() }), request.id.clone()),
        "tools/call" => {
            let params = request.params.as_ref().unwrap_or(&Value::Null);
            let tool_name = match params.get("name").and_then(|v| v.as_str()) {
                Some(n) => n,
                None => {
                    return err_response(
                        JsonRpcError::invalid_params("Missing tool name"),
                        request.id.clone(),
                    );
                }
            };
            let arguments = params
                .get("arguments")
                .cloned()
                .unwrap_or(Value::Object(serde_json::Map::new()));
            match handle_tool_call(tool_name, &arguments, &state.db_path) {
                Ok(result) => ok_response(
                    json!({
                        "content": [{
                            "type": "text",
                            "text": serde_json::to_string_pretty(&result).unwrap_or_default()
                        }]
                    }),
                    request.id.clone(),
                ),
                Err(e) => ok_response(
                    json!({
                        "content": [{ "type": "text", "text": format!("Error: {e}") }],
                        "isError": true
                    }),
                    request.id.clone(),
                ),
            }
        }
        "resources/list" => {
            let resources = json!({
                "resources": [
                    {"uri": "vrcx://schema/tables", "name": "Database Schema", "description": "List all database tables with row counts", "mimeType": "application/json"},
                    {"uri": "vrcx://context/server", "name": "MCP Server Context", "description": "Server version and available capabilities", "mimeType": "application/json"}
                ]
            });
            ok_response(resources, request.id.clone())
        }
        "resources/read" => {
            let params = request.params.as_ref().unwrap_or(&Value::Null);
            let uri = params.get("uri").and_then(|v| v.as_str()).unwrap_or("");
            match uri {
                "vrcx://schema/tables" => match list_tables_with_count(&state.db_path) {
                    Ok(data) => ok_response(json!({"contents": [{"uri": uri, "mimeType": "application/json", "text": serde_json::to_string_pretty(&data).unwrap_or_default()}]}), request.id.clone()),
                    Err(e) => err_response(JsonRpcError::invalid_params(&e), request.id.clone()),
                },
                "vrcx://context/server" => ok_response(json!({"contents": [{"uri": uri, "mimeType": "application/json", "text": serde_json::to_string_pretty(&json!({
                    "server": "vrcx-pro-mcp", "version": env!("CARGO_PKG_VERSION"),
                    "description": "VRCX-Pro MCP Server - AI assistant data interface for VRChat friendship management",
                    "capabilities": ["Friend list and status queries", "Activity feed and history", "Favorites management", "Game log analysis", "User notes and memos", "Social analytics and insights", "World visit analytics", "Co-location detection", "Write-back notes"],
                    "tips": ["Use vrcx_social_insights for quick activity summaries", "Use vrcx_get_user_profile for complete user picture", "Use vrcx_get_friend_schedule to understand when friends are online", "Use vrcx_set_note to save observations about users", "Use vrcx_get_co_location to find shared social spaces"]
                })).unwrap_or_default()}]}), request.id.clone()),
                _ => err_response(JsonRpcError::invalid_params("Unknown resource URI"), request.id.clone()),
            }
        }
        "ping" => ok_response(json!({}), request.id.clone()),
        _ => err_response(
            JsonRpcError::method_not_found(&request.method),
            request.id.clone(),
        ),
    }
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

async fn mcp_post(
    State(state): State<AppState>,
    Json(request): Json<JsonRpcRequest>,
) -> impl IntoResponse {
    let response = handle_mcp_message(&request, &state);
    (StatusCode::OK, Json(response))
}

async fn mcp_sse(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {
    let mut rx = state.tx.subscribe();
    let stream = async_stream::stream! {
        loop {
            match rx.recv().await {
                Ok(value) => {
                    let data = serde_json::to_string(&value).unwrap_or_default();
                    yield Ok(Event::default().event("message").data(data));
                }
                Err(broadcast::error::RecvError::Closed) => break,
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
            }
        }
    };
    Sse::new(stream).keep_alive(KeepAlive::default())
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

pub struct McpServer {
    shutdown_tx: broadcast::Sender<()>,
}

impl McpServer {
    pub fn start(port: u16, db_path: PathBuf) -> Self {
        let (shutdown_tx, _) = broadcast::channel::<()>(1);
        let (event_tx, _) = broadcast::channel::<Value>(64);
        let state = AppState {
            db_path: Arc::new(db_path),
            tx: event_tx,
        };
        let mut shutdown_rx = shutdown_tx.subscribe();

        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().expect("failed to create MCP tokio runtime");
            rt.block_on(async move {
                let app = Router::new()
                    .route("/mcp", post(mcp_post).get(mcp_sse))
                    .with_state(state);

                let addr = format!("127.0.0.1:{port}");
                match tokio::net::TcpListener::bind(&addr).await {
                    Ok(listener) => {
                        println!("[MCP] Server listening on http://{addr}/mcp");
                        let server = axum::serve(listener, app);
                        let _ = server
                            .with_graceful_shutdown(async move {
                                let _ = shutdown_rx.recv().await;
                                println!("[MCP] Server shutting down");
                            })
                            .await;
                    }
                    Err(e) => {
                        eprintln!("[MCP] Failed to bind to {addr}: {e}");
                    }
                }
            });
        });

        Self { shutdown_tx }
    }

    pub fn shutdown(&self) {
        let _ = self.shutdown_tx.send(());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_DB_ID: AtomicU64 = AtomicU64::new(0);

    fn create_test_db() -> PathBuf {
        let id = TEST_DB_ID.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "vrcx-pro-mcp-test-{}-{id}.db",
            std::process::id()
        ));
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch(
            "CREATE TABLE test_friend_log_current (user_id TEXT PRIMARY KEY, display_name TEXT, trust_level TEXT, friend_number INTEGER);
             CREATE TABLE test_feed_status (id INTEGER PRIMARY KEY, created_at TEXT, user_id TEXT, display_name TEXT, status TEXT, status_description TEXT, previous_status TEXT, previous_status_description TEXT);
             CREATE TABLE test_feed_online_offline (id INTEGER PRIMARY KEY, created_at TEXT, user_id TEXT, display_name TEXT, type TEXT, location TEXT, world_name TEXT, time INTEGER, group_name TEXT);
             INSERT INTO test_friend_log_current VALUES ('usr_active', 'Alice', 'trusted', 3);
             INSERT INTO test_friend_log_current VALUES ('usr_latest', 'Bob', 'known', 2);
             INSERT INTO test_friend_log_current VALUES ('usr_offline', 'Carol', 'user', 1);
             INSERT INTO test_feed_status (created_at, user_id, display_name, status) VALUES (datetime('now', '-3 hours'), 'usr_active', 'Alice', 'active');
             INSERT INTO test_feed_status (created_at, user_id, display_name, status) VALUES (datetime('now', '-3 hours'), 'usr_latest', 'Bob', 'busy');
             INSERT INTO test_feed_status (created_at, user_id, display_name, status) VALUES (datetime('now', '-2 hours'), 'usr_latest', 'Bob', 'active');
             INSERT INTO test_feed_status (created_at, user_id, display_name, status) VALUES (datetime('now', '-2 hours'), 'usr_offline', 'Carol', 'active');
             INSERT INTO test_feed_online_offline (created_at, user_id, display_name, type) VALUES (datetime('now', '-4 hours'), 'usr_active', 'Alice', 'Online');
             INSERT INTO test_feed_online_offline (created_at, user_id, display_name, type) VALUES (datetime('now', '-4 hours'), 'usr_latest', 'Bob', 'Online');
             INSERT INTO test_feed_online_offline (created_at, user_id, display_name, type) VALUES (datetime('now', '-3 hours'), 'usr_offline', 'Carol', 'Online');
             INSERT INTO test_feed_online_offline (created_at, user_id, display_name, type) VALUES (datetime('now', '-2 hours'), 'usr_offline', 'Carol', 'Offline');
             INSERT INTO test_feed_online_offline (created_at, user_id, display_name, type) VALUES (datetime('now', '-90 minutes'), 'usr_target''quoted', 'Target', 'Online');
             INSERT INTO test_feed_online_offline (created_at, user_id, display_name, type) VALUES (datetime('now', '-30 minutes'), 'usr_target''quoted', 'Target', 'Offline');",
        )
        .unwrap();
        drop(conn);
        path
    }

    fn remove_test_db(path: &Path) {
        for suffix in ["", "-wal", "-shm"] {
            let _ = std::fs::remove_file(format!("{}{suffix}", path.display()));
        }
    }

    #[test]
    fn social_insights_include_online_hour_distribution() {
        let path = create_test_db();
        let result =
            handle_tool_call("vrcx_social_insights", &json!({ "days": 7 }), &path).unwrap();
        let distribution = result
            .get("online_hour_distribution")
            .and_then(Value::as_array)
            .unwrap();
        assert!(!distribution.is_empty());
        remove_test_db(&path);
    }

    #[test]
    fn friend_schedule_returns_events_for_mixed_case_types_and_escaped_user_id() {
        let path = create_test_db();
        let result = handle_tool_call(
            "vrcx_get_friend_schedule",
            &json!({ "user_id": "usr_target'quoted", "days": 7 }),
            &path,
        )
        .unwrap();
        assert_eq!(
            result.get("hourly_online_pattern").and_then(Value::as_array).unwrap().len(),
            1
        );
        assert_eq!(
            result.get("day_of_week_pattern").and_then(Value::as_array).unwrap().len(),
            1
        );
        assert_eq!(
            result.get("recent_online_events").and_then(Value::as_array).unwrap().len(),
            2
        );
        remove_test_db(&path);
    }

    #[test]
    fn friend_status_filter_uses_latest_status_and_presence() {
        let path = create_test_db();
        let active = handle_tool_call(
            "vrcx_search_friends",
            &json!({ "status": "active", "limit": 1 }),
            &path,
        )
        .unwrap();
        let active_names: Vec<_> = active
            .as_array()
            .unwrap()
            .iter()
            .map(|row| row.get("display_name").unwrap().as_str().unwrap())
            .collect();
        assert_eq!(active_names, ["Bob"]);

        let offline = handle_tool_call(
            "vrcx_search_friends",
            &json!({ "status": "offline", "limit": 50 }),
            &path,
        )
        .unwrap();
        let offline_names: Vec<_> = offline
            .as_array()
            .unwrap()
            .iter()
            .map(|row| row.get("display_name").unwrap().as_str().unwrap())
            .collect();
        assert_eq!(offline_names, ["Carol"]);
        remove_test_db(&path);
    }
}
