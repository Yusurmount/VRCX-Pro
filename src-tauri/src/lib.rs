use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdout, Command, Stdio};
use std::sync::Mutex;
use serde_json::Value;
use std::fs;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, State};

struct SidecarProcess {
    child: Child,
    reader: BufReader<ChildStdout>,
}

struct DotnetSidecar(Mutex<Option<SidecarProcess>>);

struct TrayState(Mutex<Option<tauri::tray::TrayIcon>>);

#[tauri::command]
fn get_arch() -> String {
    std::env::consts::ARCH.to_string()
}

#[tauri::command]
fn dotnet_status(state: State<'_, DotnetSidecar>) -> bool {
    state.0.lock().expect("sidecar mutex poisoned").is_some()
}

#[tauri::command]
fn dotnet_call(
    state: State<'_, DotnetSidecar>,
    id: u64,
    class_name: String,
    method_name: String,
    args: Vec<Value>,
) -> Result<Value, String> {
    let mut guard = state.0.lock().map_err(|_| "sidecar mutex poisoned".to_string())?;
    let process = guard
        .as_mut()
        .ok_or_else(|| "The .NET sidecar is not running".to_string())?;
    let stdin = process
        .child
        .stdin
        .as_mut()
        .ok_or_else(|| "sidecar stdin unavailable".to_string())?;
    let request = serde_json::json!({
        "id": id,
        "className": class_name,
        "methodName": method_name,
        "args": args
    });
    writeln!(stdin, "{}", request).map_err(|error| error.to_string())?;
    stdin.flush().map_err(|error| error.to_string())?;

    let mut response = String::new();
    process
        .reader
        .read_line(&mut response)
        .map_err(|error| error.to_string())?;
    serde_json::from_str(response.trim()).map_err(|error| error.to_string())
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
    let mut guard = state.0.lock().map_err(|_| "sidecar mutex poisoned".to_string())?;
    if guard.is_some() {
        return Ok(true);
    }

    let sidecar_name = if cfg!(target_os = "windows") {
        "VRCX-Pro.Backend.exe"
    } else {
        "VRCX-Pro.Backend"
    };
    let resource_dir = app.path().resource_dir().map_err(|error| error.to_string())?;
    let candidates = [
        resource_dir.join("dotnet-runtime").join(sidecar_name),
        std::env::current_dir().map_err(|error| error.to_string())?.join("build/TauriBackend").join(sidecar_name),
        resource_dir.join("../build/TauriBackend").join(sidecar_name),
    ];
    let Some(sidecar) = candidates.into_iter().find(|path| path.exists()) else {
        // Development builds can run without the backend; the frontend remains usable.
        return Ok(false);
    };

    let mut child = Command::new(sidecar)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|error| error.to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "sidecar stdout unavailable".to_string())?;
    *guard = Some(SidecarProcess {
        child,
        reader: BufReader::new(stdout),
    });
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

pub fn run() {
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
        .manage(DotnetSidecar(Mutex::new(None)))
        .manage(TrayState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            get_arch,
            dotnet_status,
            start_dotnet_sidecar,
            dotnet_call,
            read_file,
            write_file,
            get_overlay_window,
            update_vr,
            set_tray_icon_notification,
            quit_application
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("VRCX-Pro");
            }

            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
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
