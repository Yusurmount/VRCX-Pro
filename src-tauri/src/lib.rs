use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdout, Command, Stdio};
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};
use serde_json::Value;
use std::fs;

struct SidecarProcess {
    child: Child,
    reader: BufReader<ChildStdout>,
}

struct DotnetSidecar(Mutex<Option<SidecarProcess>>);

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
        "id": 1,
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
    let sidecar = app
        .path()
        .resource_dir()
        .map_err(|error| error.to_string())?
        .join("dotnet-runtime")
        .join(sidecar_name);

    if !sidecar.exists() {
        // Development builds can run without the backend; the frontend remains usable.
        return Ok(false);
    }

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
