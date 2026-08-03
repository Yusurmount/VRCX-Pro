//! Tauri commands。
//!
//! - `call_dotnet`: 将前端 JSON-RPC 请求转发给 C# sidecar（数据库 / VRChat API / 日志）。
//! - `electron_call`: 在 Rust 侧实现原 Electron 主进程的 `window.electron.*` 系统集成
//!   （对话框 / 剪贴板 / 通知 / 机器绑定加密 / 文件读写 / 重启等）。

use std::path::PathBuf;
use std::process::Command;

use aes::cipher::generic_array::GenericArray;
use aes::cipher::{BlockDecrypt, BlockEncrypt, KeyInit};
use rand::RngCore;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_notification::NotificationExt;

// ────────────────────────────── call_dotnet ──────────────────────────────

#[tauri::command]
pub async fn call_dotnet(
    class_name: String,
    method_name: String,
    args: Vec<Value>,
) -> Result<Value, String> {
    eprintln!("[call_dotnet] {class_name}.{method_name} args={}", args.len());
    crate::sidecar::call_dotnet(&class_name, &method_name, args).await
}

// ────────────────────────────── electron_call ──────────────────────────────

#[tauri::command]
pub async fn electron_call(
    app: AppHandle,
    method: String,
    args: Option<Vec<Value>>,
) -> Result<Value, String> {
    let args = args.unwrap_or_default();
    eprintln!("[electron_call] {method} args={}", args.len());

    match method.as_str() {
        "getArch" => Ok(json!(arch_string())),
        "getClipboardText" => {
            // 对齐 Electron clipboard.readText()：空剪贴板返回空字符串而非报错
            match app.clipboard().read_text() {
                Ok(text) => Ok(Value::String(text)),
                Err(_) => Ok(Value::String(String::new())),
            }
        }
        "getNoUpdater" => Ok(json!(false)),
        "setTrayIconNotification" => {
            // 对齐 Electron：切换托盘图标为普通/通知图标
            let notify = args.first().and_then(|v| v.as_bool()).unwrap_or(false);
            set_tray_notify(notify);
            Ok(Value::Null)
        }
        "openFileDialog" => Ok(json!(pick_file(&app, &[("Images", &["png"])]))),
        "openJsonFileDialog" => Ok(json!(pick_file(
            &app,
            &[("VRCX Database Backup", &["json"]), ("All Files", &["*"])]
        ))),
        "openDirectoryDialog" => Ok(json!(pick_folder(&app))),
        "saveFileDialog" => Ok(json!(save_file(
            &app,
            arg_str(&args, 0).unwrap_or(""),
            arg_str(&args, 1)
        ))),
        "writeFile" => write_file(
            arg_str(&args, 0).ok_or("writeFile: missing path")?,
            args.get(1).ok_or("writeFile: missing content")?,
        ),
        "readFile" => {
            let path = arg_str(&args, 0).ok_or("readFile: missing path")?;
            std::fs::read_to_string(path).map(Value::String).map_err(|e| e.to_string())
        }
        "machineEncrypt" => {
            let plaintext = arg_str(&args, 0).ok_or("machineEncrypt: missing input")?;
            machine_encrypt(&app, plaintext).map(Value::String)
        }
        "machineDecrypt" => {
            let data = arg_str(&args, 0).ok_or("machineDecrypt: missing input")?;
            machine_decrypt(&app, data).map(Value::String)
        }
        "desktopNotification" => {
            let title = arg_str(&args, 0).unwrap_or("VRCX-Pro");
            let body = arg_str(&args, 1).unwrap_or("");
            show_notification(&app, title, body)
        }
        "appApi:DesktopNotification" => {
            let title = arg_str(&args, 0).unwrap_or("VRCX-Pro");
            let body = arg_str(&args, 1).unwrap_or("");
            show_notification(&app, title, body)
        }
        "appApi:SetTrayIconNotification" => {
            let notify = args.first().and_then(|v| v.as_bool()).unwrap_or(false);
            set_tray_notify(notify);
            Ok(Value::Null)
        }
        "appApi:SetZoom" => {
            let level = args.first().and_then(|v| v.as_f64()).unwrap_or(0.0);
            app_zoom_set(&app, level)
        }
        "appApi:GetZoom" => Ok(json!(crate::zoom_level())),
        "appApi:ShowDevTools" => {
            if let Some(win) = app.get_webview_window("main") {
                win.open_devtools();
            }
            Ok(Value::Null)
        }
        "appApi:SetStartup" => {
            let enabled = args.first().and_then(|v| v.as_bool()).unwrap_or(false);
            set_startup(enabled)?;
            Ok(Value::Null)
        }
        "appApi:FocusWindow" => {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
            Ok(Value::Null)
        }
        "appApi:FlashWindow" => {
            #[cfg(windows)]
            if let Some(win) = app.get_webview_window("main") {
                if let Ok(hwnd) = win.hwnd() {
                    flash_window(hwnd);
                }
            }
            Ok(Value::Null)
        }
        "appApi:ChangeTheme" => {
            #[cfg(windows)]
            if let Some(win) = app.get_webview_window("main") {
                if let Ok(hwnd) = win.hwnd() {
                    let value = args.first().and_then(|v| v.as_i64()).unwrap_or(0);
                    change_titlebar_theme(hwnd, value as i32);
                }
            }
            Ok(Value::Null)
        }
        "appApi:CopyImageToClipboard" => {
            let path = arg_str(&args, 0).ok_or("CopyImageToClipboard: missing path")?;
            copy_image_to_clipboard(&app, path)
        }
        "appApi:OpenCalendarFile" => {
            let ics = arg_str(&args, 0).ok_or("OpenCalendarFile: missing content")?;
            open_calendar_file(ics)
        }
        "appApi:RestartApplication" => {
            app.restart();
            #[allow(unreachable_code)]
            Ok(Value::Null)
        }
        "restartApp" => {
            app.restart();
            #[allow(unreachable_code)]
            Ok(Value::Null)
        }
        "getOverlayWindow" => Ok(json!(false)), // MVP: VR Overlay 未迁移
        "updateVr" => Ok(json!(false)),         // MVP: VR Overlay 未迁移
        other => Err(format!("unknown electron method: {other}")),
    }
}

// ────────────────────────────── helpers ──────────────────────────────

fn arg_str(args: &[Value], i: usize) -> Option<&str> {
    args.get(i).and_then(|v| v.as_str())
}

// ──────────────────────────── appApi:* 宿主辅助 ────────────────────────────

/// 显示桌面通知（对齐 Electron `new Notification({ title, body })`）。
fn show_notification(app: &AppHandle, title: &str, body: &str) -> Result<Value, String> {
    app.notification()
        .builder()
        .title(title.to_string())
        .body(body.to_string())
        .show()
        .map(|_| Value::Null)
        .map_err(|e| e.to_string())
}

/// 应用 Chromium zoom level（Electron setZoomLevel 语义：factor = 1.2^level），
/// 并保存 `VRCX_ZoomLevel` 供下次启动恢复。
fn app_zoom_set(app: &AppHandle, level: f64) -> Result<Value, String> {
    if let Some(win) = app.get_webview_window("main") {
        win.set_zoom(1.2f64.powf(level))
            .map_err(|e| format!("set_zoom: {e}"))?;
    }
    crate::set_zoom_level(level);
    Ok(json!(true))
}

/// 开机启动开关（Windows：注册表 HKCU\...\CurrentVersion\Run）。
/// 对齐 Electron app:setLoginItemSettings / Cef SetStartup 语义。
fn set_startup(enabled: bool) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| format!("current_exe: {e}"))?;
    let key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
    let status = if enabled {
        Command::new("reg")
            .args([
                "add",
                key,
                "/v",
                "VRCX-Pro",
                "/t",
                "REG_SZ",
                "/d",
                &format!("\"{}\"", exe.display()),
                "/f",
            ])
            .status()
    } else {
        Command::new("reg")
            .args(["delete", key, "/v", "VRCX-Pro", "/f"])
            .status()
    };
    status
        .map(|_| ())
        .map_err(|e| format!("reg: {e}"))
}

/// 闪烁任务栏（对齐 Electron FlashFrame）。
#[cfg(windows)]
fn flash_window(hwnd: windows::Win32::Foundation::HWND) {
    use windows::Win32::UI::WindowsAndMessaging::{
        FlashWindowEx, FLASHWINFO, FLASHW_ALL, FLASHW_TIMERNOFG,
    };
    let info = FLASHWINFO {
        cbSize: std::mem::size_of::<FLASHWINFO>() as u32,
        hwnd,
        dwFlags: FLASHW_ALL | FLASHW_TIMERNOFG,
        uCount: 0,
        dwTimeout: 0,
    };
    unsafe {
        let _ = FlashWindowEx(&info);
    }
}

/// 标题栏明暗主题（DWM，对齐 Electron nativeTheme）。
/// 2 = Midnight（强制暗色），1 = 暗色，0 = 亮色。
#[cfg(windows)]
fn change_titlebar_theme(hwnd: windows::Win32::Foundation::HWND, value: i32) {
    use windows::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWINDOWATTRIBUTE,
    };
    // DWMWA_USE_IMMERSIVE_DARK_MODE = 20；pvattribute 为 4 字节 BOOL，用 i32 等价传值
    let dark: i32 = i32::from(value >= 1);
    unsafe {
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWINDOWATTRIBUTE(20),
            (&dark as *const i32).cast(),
            std::mem::size_of::<i32>() as u32,
        );
    }
}

/// 复制图片文件到剪贴板（对齐 Electron clipboard.writeImage）。
/// 解码为 RGBA 后交给 clipboard-manager 插件（内部写 CF_DIB）。
fn copy_image_to_clipboard(app: &AppHandle, path: &str) -> Result<Value, String> {
    let img = image::open(path).map_err(|e| format!("decode image {path}: {e}"))?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    let image = tauri::image::Image::new_owned(rgba.into_raw(), w, h);
    app.clipboard()
        .write_image(&image)
        .map_err(|e| format!("clipboard: {e}"))?;
    Ok(json!(true))
}

/// 打开日历文件（写临时 .ics 并用系统默认应用打开，对齐 Electron shell.openPath）。
fn open_calendar_file(ics: &str) -> Result<Value, String> {
    let path = std::env::temp_dir().join("vrcx-calendar.ics");
    std::fs::write(&path, ics).map_err(|e| format!("write ics: {e}"))?;
    open::that(&path).map_err(|e| format!("open ics: {e}"))?;
    Ok(json!(true))
}

/// 对齐 Electron `process.arch` 的命名（x64 / arm64 / ia32）。
fn arch_string() -> &'static str {
    match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        "x86" => "ia32",
        other => other,
    }
}

/// 将 invoke 序列化后的文件内容还原为字节。
/// 兼容 ArrayBuffer（数字数组 / 索引对象）与字符串（exportImport.js 传明文）。
fn value_to_bytes(v: &Value) -> Option<Vec<u8>> {
    match v {
        Value::Array(arr) => Some(
            arr.iter()
                .filter_map(|x| x.as_u64().map(|n| n as u8))
                .collect(),
        ),
        Value::Object(map) => {
            let mut len = 0usize;
            for key in map.keys() {
                if let Ok(i) = key.parse::<usize>() {
                    len = len.max(i + 1);
                }
            }
            let mut bytes = vec![0u8; len];
            for (key, val) in map {
                if let (Ok(i), Some(n)) = (key.parse::<usize>(), val.as_u64()) {
                    if i < len {
                        bytes[i] = n as u8;
                    }
                }
            }
            Some(bytes)
        }
        Value::String(s) => Some(s.as_bytes().to_vec()),
        _ => None,
    }
}

fn write_file(path: &str, content: &Value) -> Result<Value, String> {
    let bytes = value_to_bytes(content).ok_or("writeFile: unsupported content type")?;
    std::fs::write(path, bytes).map_err(|e| e.to_string())?;
    Ok(json!(true))
}

fn pick_file(app: &AppHandle, filters: &[(&str, &[&str])]) -> Option<String> {
    let mut builder = app.dialog().file();
    for (name, exts) in filters {
        builder = builder.add_filter(*name, exts);
    }
    builder.blocking_pick_file().and_then(file_path_to_string)
}

fn pick_folder(app: &AppHandle) -> Option<String> {
    app.dialog().file().blocking_pick_folder().and_then(file_path_to_string)
}

fn save_file(app: &AppHandle, default_name: &str, format_label: Option<&str>) -> Option<String> {
    let mut builder = app.dialog().file().set_file_name(default_name);
    if let Some(label) = format_label {
        let ext = PathBuf::from(default_name)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_string();
        if !ext.is_empty() {
            builder = builder.add_filter(label, &[ext.as_str()]);
        }
    }
    builder.blocking_save_file().and_then(file_path_to_string)
}

fn file_path_to_string(p: FilePath) -> Option<String> {
    p.into_path()
        .ok()
        .map(|p| p.to_string_lossy().to_string())
}

// ─────────────────────────── machine-bound AES-256-CBC ───────────────────────────

/// 读取或创建机器绑定密钥（userData/.vrcx_machine_key，32 字节 hex）。
/// 与原 Electron 主进程实现（MACHINE_KEY_PATH）保持一致的存储语义。
fn get_or_create_machine_key(app: &AppHandle) -> Result<Vec<u8>, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let key_path = dir.join(".vrcx_machine_key");

    if let Ok(content) = std::fs::read_to_string(&key_path) {
        let trimmed = content.trim();
        if trimmed.len() >= 64 {
            if let Ok(bytes) = hex::decode(trimmed) {
                return Ok(bytes);
            }
        }
    }

    let mut key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);
    std::fs::write(&key_path, hex::encode(key)).map_err(|e| e.to_string())?;
    Ok(key.to_vec())
}

fn pkcs7_pad(data: &[u8]) -> Vec<u8> {
    let pad_len = 16 - (data.len() % 16);
    let mut out = data.to_vec();
    out.extend(std::iter::repeat(pad_len as u8).take(pad_len));
    out
}

fn pkcs7_unpad(data: &[u8]) -> Option<&[u8]> {
    let last = *data.last()?;
    let pad_len = last as usize;
    if pad_len == 0 || pad_len > data.len() || pad_len > 16 {
        return None;
    }
    if data[data.len() - pad_len..].iter().all(|&b| b == last) {
        Some(&data[..data.len() - pad_len])
    } else {
        None
    }
}

fn machine_encrypt(app: &AppHandle, plaintext: &str) -> Result<String, String> {
    let key = get_or_create_machine_key(app)?;
    let iv: [u8; 16] = rand::random();
    let padded = pkcs7_pad(plaintext.as_bytes());

    // 手动 CBC 链（cbc crate 的 Encryptor 不暴露逐块接口）
    let cipher = aes::Aes256::new_from_slice(&key).map_err(|e| e.to_string())?;
    let mut prev = GenericArray::clone_from_slice(&iv);
    let mut out = Vec::with_capacity(padded.len());
    for chunk in padded.chunks(16) {
        let mut block = GenericArray::clone_from_slice(chunk);
        for i in 0..16 {
            block[i] ^= prev[i];
        }
        cipher.encrypt_block(&mut block);
        out.extend_from_slice(&block);
        prev = block;
    }
    Ok(format!("{}:{}", hex::encode(iv), hex::encode(out)))
}

fn machine_decrypt(app: &AppHandle, data: &str) -> Result<String, String> {
    let key = get_or_create_machine_key(app)?;
    let (iv_hex, ct_hex) = data.split_once(':').ok_or("invalid encrypted data")?;

    let iv: [u8; 16] = hex::decode(iv_hex)
        .map_err(|e| e.to_string())?
        .try_into()
        .map_err(|_| "invalid iv length")?;
    let ct = hex::decode(ct_hex).map_err(|e| e.to_string())?;
    if ct.len() % 16 != 0 || ct.is_empty() {
        return Err("invalid ciphertext length".into());
    }

    let cipher = aes::Aes256::new_from_slice(&key).map_err(|e| e.to_string())?;
    let mut prev = GenericArray::clone_from_slice(&iv);
    let mut out = Vec::with_capacity(ct.len());
    for chunk in ct.chunks(16) {
        let mut block = GenericArray::clone_from_slice(chunk);
        let ciphertext_block = block.clone();
        cipher.decrypt_block(&mut block);
        for i in 0..16 {
            block[i] ^= prev[i];
        }
        out.extend_from_slice(&block);
        prev = ciphertext_block;
    }

    let unpadded = pkcs7_unpad(&out).ok_or("invalid padding")?;
    String::from_utf8(unpadded.to_vec()).map_err(|e| e.to_string())
}

// ─────────────────────────────── 托盘图标切换 ───────────────────────────────

/// 切换托盘图标（普通/通知），对齐 Electron setTrayIconNotification。
fn set_tray_notify(notify: bool) {
    if let Some(state) = crate::TRAY_STATE.get() {
        if let Ok(state) = state.lock() {
            let icon = if notify {
                state.icon_notify.clone()
            } else {
                state.icon_normal.clone()
            };
            let _ = state.tray.set_icon(Some(icon));
        }
    }
}
