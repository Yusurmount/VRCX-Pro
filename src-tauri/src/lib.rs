use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};
use serde_json::Value;
use std::fs;

struct DotnetSidecar(Mutex<Option<std::process::Child>>);

#[tauri::command]
fn get_arch() -> String {
    std::env::consts::ARCH.to_string()
}

#[tauri::command]
fn dotnet_status(state: State<'_, DotnetSidecar>) -> bool {
    state.0.lock().expect("sidecar mutex poisoned").is_some()
}

#[tauri::command]
fn dotnet_call(_class_name: String, _method_name: String, _args: Vec<Value>) -> Result<Value, String> {
    Err(".NET sidecar is not bundled in this development build".to_string())
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

    let sidecar = app
        .path()
        .resource_dir()
        .map_err(|error| error.to_string())?
        .join("dotnet-runtime")
        .join("VRCX-Pro.Backend.exe");

    if !sidecar.exists() {
        // Development builds can run without the backend; the frontend remains usable.
        return Ok(false);
    }

    let child = Command::new(sidecar)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|error| error.to_string())?;
    *guard = Some(child);
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
        .invoke_handler(tauri::generate_handler![get_arch, dotnet_status, start_dotnet_sidecar, dotnet_call, read_file, write_file])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("VRCX-Pro");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running VRCX-Pro");
}
