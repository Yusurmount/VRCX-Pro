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
                "capabilities": { "tools": { "listChanged": false } },
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
