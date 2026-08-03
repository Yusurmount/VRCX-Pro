mod commands;
mod sidecar;

use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, PhysicalPosition, PhysicalSize,
};

/// 托盘图标状态（供 `setTrayIconNotification` 切换普通/通知图标）。
pub struct TrayState {
    pub tray: TrayIcon,
    pub icon_normal: Image<'static>,
    pub icon_notify: Image<'static>,
}
pub static TRAY_STATE: OnceLock<Mutex<TrayState>> = OnceLock::new();

/// 当前 Chromium zoom level（供 `AppApi.GetZoom` 读取；启动时从 VRCX_ZoomLevel 恢复）。
pub static ZOOM_LEVEL: OnceLock<Mutex<f64>> = OnceLock::new();

/// 读取当前 zoom level。
pub fn zoom_level() -> f64 {
    *ZOOM_LEVEL.get_or_init(|| Mutex::new(0.0)).lock().unwrap()
}

/// 更新 zoom level 并持久化 `VRCX_ZoomLevel`（对齐 Electron zoom-changed 保存逻辑）。
pub fn set_zoom_level(level: f64) {
    *ZOOM_LEVEL.get_or_init(|| Mutex::new(0.0)).lock().unwrap() = level;
    set_vrcx_value("VRCX_ZoomLevel", &level.to_string());
}

/// 写 `%APPDATA%/VRCX/VRCX.json` 的键值（对齐 VRCXStorage.Set + Save）。
pub fn set_vrcx_value(key: &str, value: &str) {
    let appdata = match std::env::var("APPDATA") {
        Ok(v) => v,
        Err(_) => return,
    };
    let path = PathBuf::from(appdata).join("VRCX").join("VRCX.json");
    let mut v = vrcx_json_value().unwrap_or_else(|| json!({}));
    if let Some(obj) = v.as_object_mut() {
        obj.insert(key.to_string(), Value::String(value.to_string()));
    }
    let _ = std::fs::write(&path, serde_json::to_string_pretty(&v).unwrap_or_default());
}

/// 原 Electron 主进程通过 VRCXStorage（%APPDATA%/VRCX/VRCX.json）读取配置。
/// Tauri 侧 sidecar 尚未就绪时（setup 阶段）无法走 call_dotnet，直接解析该 JSON 文件。
fn vrcx_json_value() -> Option<Value> {
    let appdata = std::env::var("APPDATA").ok()?;
    let path = PathBuf::from(appdata).join("VRCX").join("VRCX.json");
    let content = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

/// 关闭窗口时是否隐藏到托盘（VRCX_CloseToTray == "true"）。
fn get_close_to_tray() -> bool {
    vrcx_json_value()
        .and_then(|v| {
            v.get("VRCX_CloseToTray")
                .and_then(|x| x.as_str())
                .map(|s| s == "true")
        })
        .unwrap_or(false)
}

/// 恢复上次窗口位置/大小/状态（对齐 Electron createWindow 读取 VRCXStorage 的逻辑）。
fn restore_window_bounds(win: &tauri::WebviewWindow) {
    let Some(v) = vrcx_json_value() else { return };
    let num = |k: &str| {
        v.get(k)
            .and_then(|x| x.as_str())
            .and_then(|s| s.parse::<i32>().ok())
    };

    if let (Some(x), Some(y)) = (num("VRCX_LocationX"), num("VRCX_LocationY")) {
        let _ = win.set_position(PhysicalPosition::new(x, y));
    }
    if let (Some(w), Some(h)) = (num("VRCX_SizeWidth"), num("VRCX_SizeHeight")) {
        if w > 0 && h > 0 {
            let _ = win.set_size(PhysicalSize::new(w as u32, h as u32));
        }
    }
    if v.get("VRCX_WindowState").and_then(|x| x.as_str()) == Some("2") {
        let _ = win.maximize();
    }
}

/// 创建系统托盘（对齐 Electron createTray：Open / DevTools / Quit VRCX-Pro）。
fn create_tray(app: &tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
    let devtools = MenuItem::with_id(app, "devtools", "DevTools", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit VRCX-Pro", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &devtools, &quit])?;

    let icon_normal = Image::from_bytes(include_bytes!("../icons/32x32.png"))?;
    let icon_notify = Image::from_bytes(include_bytes!("../../images/VRCX_notify.png"))?;

    let tray = TrayIconBuilder::with_id("vrcx-pro-tray")
        .icon(icon_normal.clone())
        .tooltip("VRCX-Pro")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "devtools" => {
                if let Some(win) = app.get_webview_window("main") {
                    win.open_devtools();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(win) = tray.app_handle().get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        })
        .build(app)?;

    let _ = TRAY_STATE.set(Mutex::new(TrayState {
        tray,
        icon_normal,
        icon_notify,
    }));
    Ok(())
}

/// 轮询窗口最大化/最小化状态并转发给前端（对齐 Electron maximize/minimize/
/// unmaximize/restore 事件 → setWindowState '2'/'1'/'0'/'0'）。
/// tauri::WindowEvent 无 Maximized/Minimized 变体，故用轻量轮询。
fn watch_window_state(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let Some(win) = app.get_webview_window("main") else {
            return;
        };
        let mut last = (
            win.is_maximized().unwrap_or(false),
            win.is_minimized().unwrap_or(false),
        );
        loop {
            tokio::time::sleep(Duration::from_millis(500)).await;
            let cur = (
                win.is_maximized().unwrap_or(false),
                win.is_minimized().unwrap_or(false),
            );
            if cur != last {
                last = cur;
                let state = if cur.1 {
                    "1"
                } else if cur.0 {
                    "2"
                } else {
                    "0"
                };
                let _ = app.emit("window-state-changed", state);
            }
        }
    });
}

/// VRCX-Pro Tauri 宿主入口。
///
/// - 启动时拉起 C# sidecar（VRCX-Sidecar.exe），前端通过 `call_dotnet`
///   command 转发 JSON-RPC 请求（数据库 / VRChat API / 游戏日志等）。
/// - 系统集成（对话框 / 剪贴板 / 通知 / 加密 / 托盘 / 文件）由 `electron_call`
///   command 在 Rust 侧直接实现，模拟原 Electron 主进程的 `window.electron.*`。
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        // 单实例锁（对齐 Electron requestSingleInstanceLock）：
        // 第二实例启动时激活已有窗口，并把 vrcx:// 参数转发为 launch-command。
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
            for arg in argv.iter().skip(1) {
                if let Some(cmd) = arg.strip_prefix("vrcx://") {
                    let _ = app.emit("launch-command", cmd.trim());
                }
            }
        }))
        // vrcx:// 深链协议（对齐 Electron setAsDefaultProtocolClient + open-url）。
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // 启动并监管 C# sidecar 子进程
            tauri::async_runtime::spawn(sidecar::spawn_and_supervise(app.handle().clone()));

            // vrcx:// 深链：Windows 注册协议 + 运行时 URL 转发为 launch-command
            #[cfg(target_os = "windows")]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        if let Some(win) = handle.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                        let cmd = url
                            .as_str()
                            .strip_prefix("vrcx://")
                            .unwrap_or(url.as_str());
                        let _ = handle.emit("launch-command", cmd.trim());
                    }
                });
            }

            // 系统托盘
            create_tray(app)?;

            let handle = app.handle().clone();
            let main_win = app.get_webview_window("main").expect("main window");
            let win_for_close = main_win.clone();

            // 恢复上次窗口位置/大小/状态
            restore_window_bounds(&main_win);

            // 恢复缩放级别（VRCX_ZoomLevel，Chromium zoom level → factor 1.2^level）
            let zoom = vrcx_json_value()
                .and_then(|v| {
                    v.get("VRCX_ZoomLevel")
                        .and_then(|x| x.as_str())
                        .map(|s| s.to_string())
                })
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0);
            set_zoom_level(zoom);
            let _ = main_win.set_zoom(1.2f64.powf(zoom));

            // --startup 启动时最小化/隐藏到托盘（对齐 Electron applyWindowState）
            if std::env::args().any(|a| a == "--startup") {
                if let Some(v) = vrcx_json_value() {
                    if v.get("VRCX_StartAsMinimizedState").and_then(|x| x.as_str())
                        == Some("true")
                    {
                        if get_close_to_tray() {
                            let _ = main_win.hide();
                        } else {
                            let _ = main_win.minimize();
                        }
                    }
                }
            }

            // 窗口事件转发给前端（对应 window.electron.onWindow*Changed）
            main_win.on_window_event(move |event| {
                use tauri::WindowEvent;
                match event {
                    // 关闭到托盘（VRCX_CloseToTray）
                    WindowEvent::CloseRequested { api, .. } => {
                        if get_close_to_tray() {
                            api.prevent_close();
                            let _ = win_for_close.hide();
                        }
                    }
                    WindowEvent::Moved(position) => {
                        let _ = handle.emit(
                            "window-position-changed",
                            json!({ "x": position.x, "y": position.y }),
                        );
                    }
                    WindowEvent::Resized(size) => {
                        let _ = handle.emit(
                            "window-size-changed",
                            json!({ "width": size.width, "height": size.height }),
                        );
                    }
                    WindowEvent::Focused(focused) => {
                        let _ =
                            handle.emit("browser-focus", json!({ "focused": *focused }));
                    }
                    _ => {}
                }
            });

            // 最大化/最小化状态轮询（tauri::WindowEvent 无对应变体）
            watch_window_state(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::call_dotnet,
            commands::electron_call
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
