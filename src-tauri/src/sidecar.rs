//! C# sidecar 进程管理。
//!
//! 负责拉起 `VRCX-Sidecar.exe`（编译自 Dotnet/VRCX-Sidecar.csproj），通过
//! stdin/stdout 上的换行分隔 JSON-RPC 与它通信，并将 `call_dotnet` command
//! 请求转发进去。sidecar 崩溃/退出后自动重启。

use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::Duration;

use serde_json::Value;
#[cfg(not(debug_assertions))]
use tauri::Manager;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};

type ClientRef = Mutex<Option<Arc<SidecarClient>>>;

static CLIENT: OnceLock<ClientRef> = OnceLock::new();

fn client_ref() -> &'static ClientRef {
    CLIENT.get_or_init(|| Mutex::new(None))
}

struct SidecarClient {
    child: Mutex<Option<Child>>,
    stdin: Mutex<ChildStdin>,
    pending: Mutex<std::collections::HashMap<u64, oneshot::Sender<Value>>>,
    next_id: AtomicU64,
}

/// 获取 sidecar 可执行文件路径。
/// - 开发模式（tauri dev / cargo run）：项目根的 `build/Sidecar/VRCX-Sidecar.exe`
/// - 发布模式：资源目录下的 `sidecar/VRCX-Sidecar.exe`
///   （tauri.conf.json 的 resources 映射 `"../build/Sidecar/**/*": "sidecar/"`，
///   打包后位于 `{resource_dir}/sidecar/`）
fn sidecar_exe_path(app: &tauri::AppHandle) -> PathBuf {
    #[cfg(debug_assertions)]
    {
        let _ = app;
        let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        p.pop();
        p.push("build");
        p.push("Sidecar");
        p.push(if cfg!(windows) {
            "VRCX-Sidecar.exe"
        } else {
            "VRCX-Sidecar"
        });
        p
    }
    #[cfg(not(debug_assertions))]
    {
        app.path()
            .resource_dir()
            .unwrap_or_default()
            .join("sidecar")
            .join(if cfg!(windows) {
                "VRCX-Sidecar.exe"
            } else {
                "VRCX-Sidecar"
            })
    }
}

impl SidecarClient {
    async fn new(path: PathBuf) -> Result<Arc<Self>, String> {
        let mut child = Command::new(&path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("failed to spawn sidecar {path:?}: {e}"))?;

        let stdin = child.stdin.take().ok_or("sidecar stdin unavailable")?;
        let stdout = child.stdout.take().ok_or("sidecar stdout unavailable")?;
        let stderr = child.stderr.take();

        let client = Arc::new(Self {
            child: Mutex::new(Some(child)),
            stdin: Mutex::new(stdin),
            pending: Mutex::new(std::collections::HashMap::new()),
            next_id: AtomicU64::new(1),
        });

        // stderr -> 宿主日志
        tauri::async_runtime::spawn(async move {
            if let Some(stream) = stderr {
                let mut lines = BufReader::new(stream).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    eprintln!("[sidecar] {line}");
                }
            }
        });

        // stdout -> 按 id 分发响应
        let reader_client = Arc::clone(&client);
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if let Ok(value) = serde_json::from_str::<Value>(&line) {
                    if let Some(id) = value.get("id").and_then(|v| v.as_u64()) {
                        if let Some(tx) = reader_client.pending.lock().await.remove(&id) {
                            let _ = tx.send(value);
                        }
                    }
                }
            }
        });

        Ok(client)
    }

    /// 等待子进程退出。退出后立即唤醒所有未决请求（返回 cancelled），
    /// 避免调用方在 sidecar 崩溃后空等 10 分钟超时。
    async fn wait_for_exit(&self) {
        let child = self.child.lock().await.take();
        if let Some(mut child) = child {
            let _ = child.wait().await;
        }
        self.pending.lock().await.clear();
    }

    async fn call(&self, class_name: &str, method_name: &str, args: &[Value]) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id, tx);

        let request = serde_json::json!({
            "id": id,
            "className": class_name,
            "methodName": method_name,
            "args": args,
        });
        let mut line = request.to_string();
        line.push('\n');

        let mut stdin = self.stdin.lock().await;
        stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| format!("sidecar write failed: {e}"))?;
        stdin
            .flush()
            .await
            .map_err(|e| format!("sidecar flush failed: {e}"))?;
        drop(stdin);

        // 长任务（更新下载 / 图片处理）放宽到 10 分钟
        match tokio::time::timeout(Duration::from_secs(600), rx).await {
            Ok(Ok(response)) => {
                if let Some(err) = response.get("error").and_then(|v| v.as_str()) {
                    Err(err.to_string())
                } else {
                    Ok(response.get("result").cloned().unwrap_or(Value::Null))
                }
            }
            Ok(Err(_)) => Err("sidecar request cancelled".into()),
            Err(_) => {
                self.pending.lock().await.remove(&id);
                Err("sidecar request timed out".into())
            }
        }
    }
}

/// 启动并监督 sidecar：退出或启动失败后每 2 秒重试。
///
/// 设计要点：`wait_for_exit` 只短暂持有 `child` 锁（take 后即释放），
/// 因此等待子进程退出期间 `call_dotnet` 仍可正常持有 `client_ref()`
/// 的 Arc 并转发请求，不会互相阻塞。
pub async fn spawn_and_supervise(app: tauri::AppHandle) {
    let path = sidecar_exe_path(&app);
    loop {
        match SidecarClient::new(path.clone()).await {
            Ok(client) => {
                *client_ref().lock().await = Some(Arc::clone(&client));
                eprintln!("[sidecar] started {:?}", path);
                client.wait_for_exit().await;
                *client_ref().lock().await = None;
                eprintln!("[sidecar] exited, restarting in 2s");
            }
            Err(e) => {
                eprintln!("[sidecar] spawn failed: {e}, retry in 2s");
            }
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

/// 向前端暴露的 `call_dotnet` 转发入口。
pub async fn call_dotnet(class_name: &str, method_name: &str, args: Vec<Value>) -> Result<Value, String> {
    let client = {
        let guard = client_ref().lock().await;
        guard.as_ref().map(Arc::clone)
    };
    match client {
        Some(client) => client.call(class_name, method_name, &args).await,
        None => Err("VRCX sidecar is not running".into()),
    }
}
