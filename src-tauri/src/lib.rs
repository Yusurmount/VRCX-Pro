use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex};
use serde_json::Value;
use std::fs;
use tauri::menu::{Menu, MenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, State};

struct SidecarProcess {
    child: Child,
    reader: BufReader<ChildStdout>,
}

struct DotnetSidecar(Arc<Mutex<Option<SidecarProcess>>>);

struct TrayState(Mutex<Option<tauri::tray::TrayIcon>>);

struct CloseToTray(Mutex<bool>);

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

/// Returns the `VT_LPWSTR` payload of a PROPVARIANT (tag at offset 0, pointer at
/// offset 8). The caller must release the pointer with `CoTaskMemFree`.
#[cfg(target_os = "windows")]
unsafe fn propvar_string(
    pv: &windows::Win32::System::Com::StructuredStorage::PROPVARIANT,
) -> Option<*mut u16> {
    let bytes = pv as *const windows::Win32::System::Com::StructuredStorage::PROPVARIANT
        as *const u8;
    if *(bytes as *const u16) != windows::Win32::System::Variant::VT_LPWSTR.0 {
        return None;
    }
    let ptr = *(bytes.add(8) as *const *mut u16);
    (!ptr.is_null()).then_some(ptr)
}

/// True if the NUL-terminated wide string at `ptr` equals `expected`.
#[cfg(target_os = "windows")]
unsafe fn wide_equals(ptr: *const u16, expected: &[u16]) -> bool {
    let mut i = 0usize;
    while i < expected.len() {
        let c = *ptr.add(i);
        if c != expected[i] {
            return false;
        }
        if c == 0 {
            return true;
        }
        i += 1;
    }
    *ptr.add(i) == 0
}

/// Windows silently discards toast notifications unless the toast AUMID (the Tauri
/// `identifier`, `app.vrcx`) is registered on the system. Registration happens through a
/// Start Menu shortcut that carries the `System.AppUserModel.ID` property. The NSIS
/// installer creates that shortcut, but portable / direct-run builds (e.g. extracting the
/// bundle without installing) never do, so notifications "fail silently".
///
/// As a safety net we ensure the per-user Start Menu shortcut (pointing at the current
/// executable) carries that property, (re)creating it when missing. Dev builds running
/// from `target/debug|release` are skipped: dev toasts already work through the
/// notification plugin's dev fallback, and pointing a Start Menu shortcut at a build
/// artifact would only pollute the menu.
#[cfg(target_os = "windows")]
fn ensure_toast_shortcut(app: &tauri::App) {
    use windows::Win32::Storage::EnhancedStorage::PKEY_AppUserModel_ID;
    use windows::Win32::System::Com::StructuredStorage::PROPVARIANT;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemAlloc, CoTaskMemFree, CoUninitialize,
        CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, IPersistFile, STGM_READ,
    };
    use windows::Win32::System::Variant::VT_LPWSTR;
    use windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;
    use windows::Win32::UI::Shell::IShellLinkW;
    use windows::core::{Interface, PCWSTR, GUID};

    const CLSID_SHELL_LINK: GUID =
        GUID::from_u128(0x00021401_0000_0000_c000_000000000046);

    let Ok(appdata) = std::env::var("APPDATA") else {
        return;
    };
    let start_menu = format!(
        r"{}\Microsoft\Windows\Start Menu\Programs\VRCX-Pro.lnk",
        appdata.trim_end_matches('\\')
    );
    let Ok(exe) = std::env::current_exe() else {
        return;
    };
    let Some(exe_dir) = exe.parent() else {
        return;
    };
    let dir_str = exe_dir.to_string_lossy().to_string();
    if dir_str.ends_with(r"\target\debug") || dir_str.ends_with(r"\target\release") {
        return;
    }

    let wide = |s: &str| -> Vec<u16> { s.encode_utf16().chain(std::iter::once(0)).collect() };
    let aumid = app.config().identifier.clone();
    let exe_wide = wide(&exe.to_string_lossy());
    let dir_wide = wide(&exe_dir.to_string_lossy());
    let lnk_wide = wide(&start_menu);
    let aumid_wide = wide(&aumid);

    // S_OK (first init) and S_FALSE (already initialized) are both success.
    if unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }.is_err() {
        return;
    }
    let result = (|| -> windows::core::Result<()> {
        let link: IShellLinkW =
            unsafe { CoCreateInstance(&CLSID_SHELL_LINK, None, CLSCTX_INPROC_SERVER)? };

        // A shortcut may already exist (e.g. created by the NSIS installer). Only
        // act when it does not carry our AUMID yet.
        if std::path::Path::new(&start_menu).exists() {
            let persist: IPersistFile = link.cast()?;
            unsafe {
                persist.Load(PCWSTR(lnk_wide.as_ptr()), STGM_READ)?;
            }
            let store: IPropertyStore = link.cast()?;
            let got = unsafe { store.GetValue(&PKEY_AppUserModel_ID)? };
            let value = unsafe { propvar_string(&got) };
            let present = value.is_some_and(|ptr| unsafe { wide_equals(ptr, &aumid_wide) });
            if let Some(ptr) = value {
                unsafe { CoTaskMemFree(Some(ptr as *const _)) };
            }
            if present {
                return Ok(());
            }
            // Fall through and recreate the shortcut with the property set.
        }

        unsafe {
            link.SetPath(PCWSTR(exe_wide.as_ptr()))?;
            link.SetWorkingDirectory(PCWSTR(dir_wide.as_ptr()))?;
        }

        // The ShellLink class object also implements IPropertyStore; stamp the
        // `System.AppUserModel.ID` property so Windows maps this AUMID to the app.
        let store: IPropertyStore = link.cast()?;
        // Build a VT_LPWSTR PROPVARIANT by hand (the InitPropVariant* helpers were
        // dropped from windows-rs), allocating the string with CoTaskMemAlloc.
        let mut var = PROPVARIANT::default();
        let len_bytes = aumid_wide.len() * std::mem::size_of::<u16>();
        let buf = unsafe { CoTaskMemAlloc(len_bytes) };
        if buf.is_null() {
            return Err(windows::core::Error::from_win32());
        }
        let pwsz = buf as *mut u16;
        unsafe {
            std::ptr::copy_nonoverlapping(aumid_wide.as_ptr(), pwsz, aumid_wide.len());
        }
        {
            // `var` is zeroed. Write the PROPVARIANT head manually with the same
            // memory layout windows-rs exposes: VARENUM tag at offset 0, three
            // reserved u16 at offset 2..8 and the union's pointer at offset 8.
            let bytes = &mut var as *mut PROPVARIANT as *mut u8;
            unsafe {
                *(bytes as *mut u16) = VT_LPWSTR.0;
                *(bytes.add(8) as *mut *mut u16) = pwsz;
            }
        }
        unsafe {
            store.SetValue(&PKEY_AppUserModel_ID, &var)?;
            store.Commit()?;
        }
        unsafe { CoTaskMemFree(Some(buf)) };

        let persist: IPersistFile = link.cast()?;
        unsafe {
            persist.Save(PCWSTR(lnk_wide.as_ptr()), true)?;
        }
        Ok(())
    })();
    let _ = result;
    unsafe {
        let _ = CoUninitialize();
    }
}

#[tauri::command]
fn get_arch() -> String {
    std::env::consts::ARCH.to_string()
}

#[tauri::command]
fn dotnet_status(state: State<'_, DotnetSidecar>) -> bool {
    state.0.lock().expect("sidecar mutex poisoned").is_some()
}

#[tauri::command]
async fn dotnet_call(
    state: State<'_, DotnetSidecar>,
    id: u64,
    class_name: String,
    method_name: String,
    args: Vec<Value>,
) -> Result<Value, String> {
    // The sidecar I/O is blocking, so run it on the dedicated blocking pool instead
    // of the main thread / async workers, otherwise the UI freezes while waiting
    // for a slow (e.g. network) response. The mutex serializes access, so at most
    // one thread is ever waiting on the sidecar.
    let inner = Arc::clone(&state.0);
    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = inner.lock().map_err(|_| "sidecar mutex poisoned".to_string())?;
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
    })
    .await
    .map_err(|error| error.to_string())?
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
    // `CARGO_MANIFEST_DIR` points at src-tauri.
    let dev_backend = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../build/TauriBackend")
        .join(sidecar_name);
    // Prefer the freshly published backend in dev: `build:tauri-backend:dev`
    // produces a framework-dependent build that runs with the system-installed
    // .NET. The bundled `resource_dir/dotnet-runtime` only gets refreshed on a
    // full `tauri build`, so an earlier self-contained publish there is stale
    // and may fail even when .NET is installed. In packaged builds this dev
    // path does not exist, so it falls back to the bundled runtime.
    let candidates = [dev_backend, resource_dir.join("dotnet-runtime").join(sidecar_name)];
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
        .manage(DotnetSidecar(Arc::new(Mutex::new(None))))
        .manage(TrayState(Mutex::new(None)))
        .manage(CloseToTray(Mutex::new(false)))
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
            quit_application,
            set_close_to_tray,
            show_main_window
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
                ensure_toast_shortcut(app);
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("VRCX-Pro");
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
