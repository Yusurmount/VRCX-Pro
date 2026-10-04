use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdout, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use tauri::menu::{Menu, MenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, State};

mod mcp;

type PendingResponses = Arc<Mutex<HashMap<u64, (u64, mpsc::Sender<Value>)>>>;

struct SidecarProcess {
    // Kept only so the child process handle stays owned by this struct;
    // stdin/stdout are split out for concurrent request multiplexing.
    _child: Child,
    stdin: Mutex<ChildStdin>,
}

struct DotnetSidecar {
    process: Arc<Mutex<Option<SidecarProcess>>>,
    pending: PendingResponses,
    next_request_id: AtomicU64,
}

struct TrayState(Mutex<Option<tauri::tray::TrayIcon>>);

struct CloseToTray(Mutex<bool>);

struct McpServerState(Mutex<Option<mcp::McpServer>>);

struct LaunchArgsState(LaunchArgs);

/// Parsed command-line launch arguments, mirroring the old .NET StartupArgs.
#[derive(Clone, serde::Serialize)]
struct LaunchArgs {
    /// App was launched at Windows startup (pass `--startup`).
    startup: bool,
    /// Debug mode enabled (pass `--debug`).
    debug: bool,
    /// VR overlay mode (pass `--overlay`).
    overlay: bool,
    /// Disable GPU acceleration (pass `--disable-gpu`).
    disable_gpu: bool,
    /// Center window on screen (pass `--center`).
    center: bool,
    maximized: bool,
    fullscreen: bool,
    reset_window: bool,
    /// Custom config directory (pass `--config=<dir>`).
    config_directory: Option<String>,
    /// Proxy server URL (pass `--proxy-server=<url>`).
    proxy_server: Option<String>,
    /// Override window width (pass `--width=<N>`).
    width: Option<u32>,
    /// Override window height (pass `--height=<N>`).
    height: Option<u32>,
    /// Launch command from vrcx:// URI (pass `vrcx://...`).
    launch_command: Option<String>,
}

fn parse_launch_args(args: &[String]) -> LaunchArgs {
    let mut result = LaunchArgs {
        startup: false,
        debug: false,
        overlay: false,
        disable_gpu: false,
        center: false,
        maximized: false,
        fullscreen: false,
        reset_window: false,
        config_directory: None,
        proxy_server: None,
        width: None,
        height: None,
        launch_command: None,
    };
    for arg in args {
        if arg == "--startup" || arg == "--minimized" {
            result.startup = true;
        } else if arg == "--debug" {
            result.debug = true;
        } else if arg == "--overlay" {
            result.overlay = true;
        } else if arg == "--disable-gpu" {
            result.disable_gpu = true;
        } else if arg == "--center" {
            result.center = true;
        } else if arg == "--maximized" {
            result.maximized = true;
        } else if arg == "--fullscreen" {
            result.fullscreen = true;
        } else if arg == "--reset-window" {
            result.reset_window = true;
        } else if let Some(rest) = arg.strip_prefix("--config=") {
            result.config_directory = Some(rest.trim_matches(|c| c == '"' || c == '\'').to_string());
        } else if let Some(rest) = arg.strip_prefix("--proxy-server=") {
            result.proxy_server = Some(rest.trim_matches(|c| c == '"' || c == '\'').to_string());
        } else if let Some(rest) = arg.strip_prefix("--width=") {
            result.width = rest.parse().ok();
        } else if let Some(rest) = arg.strip_prefix("--height=") {
            result.height = rest.parse().ok();
        } else if arg.starts_with("vrcx://") {
            result.launch_command = Some(arg.clone());
        }
    }
    result
}

/// Registers the process-level AppUserModelID so Windows toast notifications
/// work even in dev / portable (non-installed) builds, where no Start-menu
/// shortcut AUMID is available. Without this the notification plugin's toasts
/// fail silently on Windows.
#[cfg(target_os = "windows")]
fn set_app_user_model_id(app: &tauri::App) {
    use windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
    let id = app.config().identifier.clone();
    let wide: Vec<u16> = id.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        let _ = SetCurrentProcessExplicitAppUserModelID(wide.as_ptr());
    }
}

#[tauri::command]
fn get_arch() -> String {
    std::env::consts::ARCH.to_string()
}

#[tauri::command]
fn dotnet_status(state: State<'_, DotnetSidecar>) -> bool {
    state.process.lock().expect("sidecar mutex poisoned").is_some()
}

/// Reads sidecar responses on a dedicated thread and routes each line to the
/// waiting caller by response id, so concurrent `dotnet_call`s can share the
/// pipe. An unparsable line is skipped; EOF fails every pending caller instead
/// of hanging.
fn spawn_response_reader(stdout: BufReader<ChildStdout>, pending: PendingResponses) {
    std::thread::spawn(move || {
        let mut reader = stdout;
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    match serde_json::from_str::<Value>(line.trim()) {
                        Ok(mut value) => {
                            let response_id = value.get("id").and_then(Value::as_u64);
                            if let Some(response_id) = response_id {
                                let entry = pending
                                    .lock()
                                    .unwrap_or_else(|poisoned| poisoned.into_inner())
                                    .remove(&response_id);
                                if let Some((caller_id, sender)) = entry {
                                    // .NET echoes the id Rust sent; restore the
                                    // caller's original id to keep the response
                                    // contract unchanged for the frontend.
                                    value["id"] = Value::from(caller_id);
                                    let _ = sender.send(value);
                                } else {
                                    eprintln!("[dotnet] response with unknown id {response_id} dropped");
                                }
                            } else {
                                eprintln!("[dotnet] response without id dropped");
                            }
                        }
                        Err(_) => {
                            eprintln!("[dotnet] unparsable response line skipped");
                        }
                    }
                }
            }
        }
        pending
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clear();
    });
}

#[tauri::command]
async fn dotnet_call(
    state: State<'_, DotnetSidecar>,
    id: u64,
    class_name: String,
    method_name: String,
    args: Vec<Value>,
) -> Result<Value, String> {
    // The sidecar I/O is blocking, so run it on the dedicated blocking pool
    // instead of the main thread / async workers, otherwise the UI freezes
    // while waiting for a slow (e.g. network) response. The stdin mutex only
    // covers writing the request line; waiting for the response happens
    // without holding any lock, so other calls can proceed concurrently.
    let process = Arc::clone(&state.process);
    let pending = Arc::clone(&state.pending);
    let rust_id = state.next_request_id.fetch_add(1, Ordering::Relaxed);
    tauri::async_runtime::spawn_blocking(move || {
        let (sender, receiver) = mpsc::channel();
        pending
            .lock()
            .map_err(|_| "sidecar pending map poisoned".to_string())?
            .insert(rust_id, (id, sender));

        let request = serde_json::json!({
            "id": rust_id,
            "className": class_name,
            "methodName": method_name,
            "args": args
        });
        {
            let result = process
                .lock()
                .map_err(|_| "sidecar mutex poisoned".to_string())
                .and_then(|guard| {
                    guard
                        .as_ref()
                        .ok_or_else(|| "The .NET sidecar is not running".to_string())
                        .and_then(|sidecar| {
                            let mut stdin = sidecar
                                .stdin
                                .lock()
                                .map_err(|_| "sidecar stdin mutex poisoned".to_string())?;
                            writeln!(stdin, "{}", request).map_err(|error| error.to_string())?;
                            stdin.flush().map_err(|error| error.to_string())
                        })
                });
            if let Err(error) = result {
                pending
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner())
                    .remove(&rust_id);
                return Err(error);
            }
        }

        receiver
            .recv()
            .map_err(|_| "The .NET sidecar stopped before responding".to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

/// Native-thread 1s ticker driving the frontend game-log poll. The WebView2
/// renderer freezes while the window is minimized / fully occluded, killing
/// every webview-side timer (worker-timers included); a native thread keeps
/// ticking and the queued events are delivered the moment the renderer
/// resumes, so the backlog is drained as soon as the window is looked at.
/// The tick carries no data: the frontend still pulls `LogWatcher.Get()`
/// itself, so events stay in the sidecar queue until actually processed.
static GAMELOG_TICK_STARTED: AtomicBool = AtomicBool::new(false);

/// True once the native game-log tick thread has been started.
#[tauri::command]
fn start_gamelog_tick(app: tauri::AppHandle) -> bool {
    if GAMELOG_TICK_STARTED.swap(true, Ordering::SeqCst) {
        return true;
    }
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(1000));
        let _ = app.emit_to("main", "gamelog-tick", ());
    });
    true
}

#[tauri::command]
fn read_file(file_path: String) -> Result<Vec<u8>, String> {
    fs::read(file_path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_file(file_path: String, bytes: Vec<u8>) -> Result<bool, String> {
    fs::write(file_path, bytes)
        .map(|_| true)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn start_dotnet_sidecar(app: tauri::AppHandle, state: State<'_, DotnetSidecar>) -> Result<bool, String> {
    let mut guard = state.process.lock().map_err(|_| "sidecar mutex poisoned".to_string())?;
    if guard.is_some() {
        return Ok(true);
    }

    let sidecar_name = if cfg!(target_os = "windows") {
        "VRCX-Pro.Backend.exe"
    } else {
        "VRCX-Pro.Backend"
    };
    let resource_dir = app.path().resource_dir().map_err(|error| error.to_string())?;
    let bundled = resource_dir.join("dotnet-runtime").join(sidecar_name);
    // In dev builds, prefer the freshly published backend:
    // `build:tauri-backend:dev` produces a framework-dependent build that runs
    // with the system-installed .NET. The bundled `resource_dir/dotnet-runtime`
    // only gets refreshed on a full `tauri build`, so an earlier self-contained
    // publish there is stale and may fail even when .NET is installed.
    // Release builds must not consider this path: `CARGO_MANIFEST_DIR` is
    // compiled in as an absolute path, so on the build machine it would exist
    // and hijack an installed app's sidecar with the repo's latest build.
    #[cfg(debug_assertions)]
    let candidates = {
        let dev_backend = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../build/TauriBackend")
            .join(sidecar_name);
        [dev_backend, bundled]
    };
    #[cfg(not(debug_assertions))]
    let candidates = [bundled];
    let Some(sidecar) = candidates.into_iter().find(|path| path.exists()) else {
        // Development builds can run without the backend; the frontend remains usable.
        return Ok(false);
    };

    let mut command = Command::new(sidecar);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .env("VRCX_APP_EXE", std::env::current_exe().unwrap_or_default());
    #[cfg(target_os = "windows")]
    {
        // The backend is a console app; hide its window so no extra cmd window
        // pops up next to the GUI (CREATE_NO_WINDOW = 0x08000000).
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|error| error.to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "sidecar stdout unavailable".to_string())?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "sidecar stdin unavailable".to_string())?;
    *guard = Some(SidecarProcess {
        _child: child,
        stdin: Mutex::new(stdin),
    });
    drop(guard);
    spawn_response_reader(BufReader::new(stdout), Arc::clone(&state.pending));
    Ok(true)
}

#[tauri::command]
fn get_overlay_window() -> Option<Value> {
    None
}

#[tauri::command]
fn update_vr(active: bool, hmd_overlay: bool, wrist_overlay: bool, menu_button: bool, overlay_hand: u32) -> Result<bool, String> {
    let _ = (active, hmd_overlay, wrist_overlay, menu_button, overlay_hand);
    Ok(true)
}

#[tauri::command]
fn set_tray_icon_notification(state: State<'_, TrayState>, notify: bool) -> Result<bool, String> {
    if let Some(tray) = state.0.lock().map_err(|_| "tray mutex poisoned".to_string())?.as_ref() {
        let tooltip = if notify { "VRCX-Pro: notification" } else { "VRCX-Pro" };
        let _ = tray.set_tooltip(Some(tooltip));
    }
    Ok(true)
}

#[tauri::command]
fn quit_application(app: tauri::AppHandle) -> Result<bool, String> {
    app.exit(0);
    Ok(true)
}

#[tauri::command]
fn set_close_to_tray(state: State<'_, CloseToTray>, enabled: bool) -> Result<bool, String> {
    *state.0.lock().map_err(|_| "close to tray mutex poisoned".to_string())? = enabled;
    Ok(true)
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    Ok(true)
}

#[tauri::command]
fn resize_window(app: tauri::AppHandle, width: f64, height: f64) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        let size = tauri::LogicalSize::new(width, height);
        let _ = window.set_size(size);
    }
    Ok(true)
}

#[tauri::command]
fn set_window_zoom(app: tauri::AppHandle, zoom: f64) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_zoom(zoom).map_err(|error| error.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
fn center_window(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.center();
    }
    Ok(true)
}

#[tauri::command]
fn open_devtools(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.open_devtools();
    }
    Ok(true)
}

#[tauri::command]
fn get_launch_args(state: State<'_, LaunchArgsState>) -> LaunchArgs {
    state.0.clone()
}


#[tauri::command]
fn start_mcp_server(
    state: State<'_, McpServerState>,
    port: u16,
) -> Result<bool, String> {
    let mut guard = state.0.lock().map_err(|_| "mcp mutex poisoned".to_string())?;
    if guard.is_some() {
        return Ok(true);
    }
    let path = if let Some(appdata) = std::env::var("APPDATA").ok() {
        std::path::PathBuf::from(appdata).join("VRCX").join("VRCX.sqlite3")
    } else if let Some(home) = std::env::var("HOME").ok() {
        std::path::PathBuf::from(home).join(".local").join("share").join("VRCX").join("VRCX.sqlite3")
    } else {
        return Err("Cannot determine default database path".to_string());
    };
    if !path.exists() {
        return Err(format!("Database not found: {}", path.display()));
    }
    let server = mcp::McpServer::start(port, path);
    *guard = Some(server);
    Ok(true)
}
#[tauri::command]
fn stop_mcp_server(state: State<'_, McpServerState>) -> Result<bool, String> {
    let mut guard = state.0.lock().map_err(|_| "mcp mutex poisoned".to_string())?;
    if let Some(server) = guard.take() {
        server.shutdown();
    }
    Ok(true)
}

#[tauri::command]
fn mcp_server_status(state: State<'_, McpServerState>) -> bool {
    state.0.lock().expect("mcp mutex poisoned").is_some()
}

pub fn run() {
    let launch_args = parse_launch_args(&std::env::args().collect::<Vec<_>>());

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.emit("launch-command", argv.last().cloned().unwrap_or_default());
            }
        }))
        .manage(DotnetSidecar {
            process: Arc::new(Mutex::new(None)),
            pending: Arc::new(Mutex::new(HashMap::new())),
            next_request_id: AtomicU64::new(1),
        })
        .manage(TrayState(Mutex::new(None)))
        .manage(CloseToTray(Mutex::new(false)))
        .manage(LaunchArgsState(launch_args))
        .manage(McpServerState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            get_arch,
            dotnet_status,
            start_dotnet_sidecar,
        start_gamelog_tick,
            dotnet_call,
            read_file,
            write_file,
            get_overlay_window,
            update_vr,
            set_tray_icon_notification,
            quit_application,
            set_close_to_tray,
            show_main_window,
            resize_window,
            set_window_zoom,
            center_window,
            open_devtools,
            get_launch_args,
            start_mcp_server,
            stop_mcp_server,
            mcp_server_status
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let close_to_tray = window
                    .state::<CloseToTray>()
                    .0
                    .lock()
                    .map(|guard| *guard)
                    .unwrap_or(false);
                if close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            #[cfg(target_os = "windows")]
            {
                set_app_user_model_id(app);
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("VRCX-Pro");
                let launch_args = app.state::<LaunchArgsState>().0.clone();
                if launch_args.reset_window {
                    let size = tauri::LogicalSize::new(1280.0, 800.0);
                    let _ = window.set_size(size);
                    let _ = window.center();
                }
                if launch_args.fullscreen {
                    let _ = window.set_fullscreen(true);
                } else if launch_args.maximized {
                    let _ = window.maximize();
                }
            }

            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let devtools_item = MenuItem::with_id(app, "devtools", "Open DevTools", true, None::<&str>)?;
            let reload_item = MenuItem::with_id(app, "reload", "Reload", true, None::<&str>)?;
            let devtools_submenu = Submenu::with_items(app, "Dev Tools", true, &[&devtools_item, &reload_item])?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &devtools_submenu, &quit_item])?;
            let decoded = image::load_from_memory(include_bytes!("../../images/VRCX.png"))
                .map_err(|error| error.to_string())?.to_rgba8();
            let (width, height) = decoded.dimensions();
            let tray_icon = tauri::image::Image::new_owned(decoded.into_raw(), width, height);
            let tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "devtools" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.open_devtools();
                        }
                    }
                    "reload" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.reload();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            *app.state::<TrayState>().0.lock().expect("tray mutex poisoned") = Some(tray);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running VRCX-Pro");
}

#[cfg(test)]
mod tests {
    use super::parse_launch_args;

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn minimized_is_an_alias_for_startup() {
        let launch_args = parse_launch_args(&args(&["VRCX-Pro.exe", "--minimized"]));

        assert!(launch_args.startup);
    }

    #[test]
    fn parses_window_state_arguments() {
        let launch_args = parse_launch_args(&args(&[
            "VRCX-Pro.exe",
            "--maximized",
            "--fullscreen",
            "--reset-window",
        ]));

        assert!(launch_args.maximized);
        assert!(launch_args.fullscreen);
        assert!(launch_args.reset_window);
    }
}
