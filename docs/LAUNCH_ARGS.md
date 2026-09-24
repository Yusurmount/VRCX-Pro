# VRCX-Pro 启动参数文档

> 本文档详细说明 VRCX-Pro 支持的所有命令行启动参数。

---

## 目录

- [1. 概述](#1-概述)
- [2. 参数列表](#2-参数列表)
- [3. 参数详细说明](#3-参数详细说明)
  - [3.1 --startup / --minimized](#31---startup---minimized)
  - [3.2 --debug](#32---debug)
  - [3.3 --overlay](#33---overlay)
  - [3.4 --config=](#34---config)
  - [3.5 --proxy-server=](#35---proxy-server)
  - [3.6 --width= 和 --height=](#36---width-和---height)
  - [3.7 --center](#37---center)
  - [3.8 --disable-gpu](#38---disable-gpu)
  - [3.9 --maximized](#39---maximized)
  - [3.10 --fullscreen](#310---fullscreen)
  - [3.11 --reset-window](#311---reset-window)
- [4. 使用示例](#4-使用示例)
- [5. 配置方法](#5-配置方法)
- [6. 注意事项](#6-注意事项)

---

## 1. 概述

VRCX-Pro 支持通过命令行参数自定义启动行为。这些参数可以在手动启动程序时添加，也可以配置到快捷方式或注册表中实现自动化启动。

**参数解析流程：**
```
命令行参数 → Rust 后端 (lib.rs) → Tauri IPC → 前端 (app.js) → 应用行为
```

---

## 2. 参数列表

| 参数 | 语法 | 说明 |
|------|------|------|
| `--startup` / `--minimized` | `--startup` 或 `--minimized` | 启动时最小化到系统托盘 |
| `--debug` | `--debug` | 启用调试模式 |
| `--overlay` | `--overlay` | 启用 VR 覆盖模式 |
| `--config=` | `--config=<路径>` | 指定自定义配置目录 |
| `--proxy-server=` | `--proxy-server=<地址>` | 设置代理服务器 |
| `--width=` | `--width=<像素>` | 设置窗口宽度 |
| `--height=` | `--height=<像素>` | 设置窗口高度 |
| `--center` | `--center` | 窗口居中显示 |
| `--disable-gpu` | `--disable-gpu` | 禁用 GPU 加速 |
| `--maximized` | `--maximized` | 启动时最大化窗口 |
| `--fullscreen` | `--fullscreen` | 启动时全屏显示 |
| `--reset-window` | `--reset-window` | 重置窗口尺寸和位置 |

---

## 3. 参数详细说明

### 3.1 --startup / --minimized

**功能：** 启动时最小化到系统托盘，不显示主窗口。

**使用场景：**
- 开机自启动时隐藏窗口
- 后台运行服务

**行为：**
- 窗口启动后立即最小化到托盘
- 需要手动点击托盘图标显示窗口
- 与"开机自启动"设置配合使用

**示例：**
```bash
VRCX-Pro.exe --startup
VRCX-Pro.exe --minimized
```

### 3.2 --debug

**功能：** 启用调试模式，输出详细的调试信息。

**使用场景：**
- 问题排查
- 开发调试
- 收集错误日志

**行为：**
- 启用详细的控制台输出
- 可能显示额外的调试信息
- 建议在遇到问题时使用

**示例：**
```bash
VRCX-Pro.exe --debug
```

### 3.3 --overlay

**功能：** 启用 VR 覆盖模式（Overlay Mode）。

**使用场景：**
- VRChat 中使用叠加界面
- 需要在 VR 环境中显示信息

**行为：**
- 启用 VR 覆盖窗口功能
- 可能影响窗口显示模式
- 需要 VR 头显支持

**示例：**
```bash
VRCX-Pro.exe --overlay
```

### 3.4 --config=

**功能：** 指定自定义配置目录路径。

**使用场景：**
- 多账号管理
- 便携版运行
- 配置文件隔离

**语法：**
```bash
--config=<目录路径>
```

**行为：**
- 覆盖默认的配置目录 (`%APPDATA%/VRCX`)
- 所有配置文件将存储在指定目录
- 如果目录不存在，会自动创建

**示例：**
```bash
VRCX-Pro.exe --config="D:\VRCX-Configs\Account1"
VRCX-Pro.exe --config="C:\Portable\VRCX"
```

### 3.5 --proxy-server=

**功能：** 设置 HTTP/HTTPS 代理服务器。

**使用场景：**
- 网络代理环境
- 企业内网访问
- 地区限制绕过

**语法：**
```bash
--proxy-server=<代理地址>
```

**支持的格式：**
- `http://host:port`
- `https://host:port`
- `socks5://host:port`

**行为：**
- 所有网络请求通过指定代理
- 覆盖系统代理设置
- 保存到配置中，后续启动继续使用

**示例：**
```bash
VRCX-Pro.exe --proxy-server="http://127.0.0.1:1080"
VRCX-Pro.exe --proxy-server="socks5://localhost:1080"
```

### 3.6 --width= 和 --height=

**功能：** 指定启动时的窗口尺寸。

**使用场景：**
- 固定窗口大小
- 适配特定分辨率
- 多显示器环境

**语法：**
```bash
--width=<像素宽度>
--height=<像素高度>
```

**行为：**
- 设置窗口的初始宽度和高度
- 单位为像素
- 可以只指定一个维度
- 保存到配置中，后续启动继续使用

**示例：**
```bash
VRCX-Pro.exe --width=1920 --height=1080
VRCX-Pro.exe --width=1280
VRCX-Pro.exe --height=800
```

### 3.7 --center

**功能：** 启动时将窗口居中显示。

**使用场景：**
- 多显示器环境
- 统一窗口位置
- 美观需求

**行为：**
- 清除保存的窗口位置
- 将窗口居中放置在主显示器
- 与 `--width`/`--height` 配合使用效果更佳

**示例：**
```bash
VRCX-Pro.exe --center
VRCX-Pro.exe --width=1280 --height=800 --center
```

### 3.8 --disable-gpu

**功能：** 禁用 GPU 硬件加速。

**使用场景：**
- GPU 驱动问题
- 兼容性问题
- 性能问题排查

**行为：**
- 禁用 WebView2 的 GPU 加速
- 使用软件渲染
- 可能影响性能，但提高兼容性

**示例：**
```bash
VRCX-Pro.exe --disable-gpu
```

### 3.9 --maximized

**功能：** 启动时将主窗口最大化。

**示例：**
```bash
VRCX-Pro.exe --maximized
```

### 3.10 --fullscreen

**功能：** 启动时以全屏模式显示主窗口。与 `--maximized` 同时使用时，全屏模式优先。

**示例：**
```bash
VRCX-Pro.exe --fullscreen
```

### 3.11 --reset-window

**功能：** 清除保存的窗口尺寸和位置，并以默认尺寸启动。

**使用场景：**
- 窗口尺寸异常
- 窗口位置超出可见屏幕
- 多显示器配置变更后恢复默认布局

**示例：**
```bash
VRCX-Pro.exe --reset-window
```

---

## 4. 使用示例

### 4.1 基础启动

```bash
# 正常启动
VRCX-Pro.exe

# 调试模式启动
VRCX-Pro.exe --debug
```

### 4.2 窗口配置

```bash
# 指定窗口大小
VRCX-Pro.exe --width=1600 --height=900

# 窗口居中
VRCX-Pro.exe --center

# 组合使用
VRCX-Pro.exe --width=1280 --height=800 --center
```

### 4.3 网络配置

```bash
# HTTP 代理
VRCX-Pro.exe --proxy-server="http://127.0.0.1:1080"

# SOCKS5 代理
VRCX-Pro.exe --proxy-server="socks5://localhost:1080"
```

### 4.4 多账号管理

```bash
# 账号1
VRCX-Pro.exe --config="D:\VRCX\Account1"

# 账号2
VRCX-Pro.exe --config="D:\VRCX\Account2"
```

### 4.5 后台运行

```bash
# 启动时最小化到托盘
VRCX-Pro.exe --startup

# 配合开机自启动
# 注册表路径: HKCU\Software\Microsoft\Windows\CurrentVersion\Run
# 值: "VRCX-Pro"="\"C:\Path\To\VRCX-Pro.exe\""
```

### 4.6 便携版运行

```bash
# 指定当前目录为配置目录
VRCX-Pro.exe --config=".\config"

# 或使用绝对路径
VRCX-Pro.exe --config="E:\PortableApps\VRCX-Pro\config"
```

---

## 5. 配置方法

### 5.1 命令行直接使用

在命令提示符或 PowerShell 中直接运行：

```cmd
cd "C:\Program Files\VRCX-Pro"
VRCX-Pro.exe --width=1600 --height=900 --center
```

### 5.2 创建快捷方式

1. 右键点击 VRCX-Pro.exe，选择"创建快捷方式"
2. 右键点击快捷方式，选择"属性"
3. 在"目标"字段末尾添加参数：
   ```
   "C:\Program Files\VRCX-Pro\VRCX-Pro.exe" --width=1600 --height=900 --center
   ```
4. 点击"确定"保存

### 5.3 开机自启动配置

通过程序内置设置（推荐）：
1. 打开 VRCX-Pro
2. 进入 **设置 → 系统**
3. 启用"开机自启动"

通过注册表手动配置：
```
注册表路径: HKCU\Software\Microsoft\Windows\CurrentVersion\Run
键名: VRCX-Pro
值: "C:\Program Files\VRCX-Pro\VRCX-Pro.exe"
```

**注意：** 默认自启动不带 `--startup` 参数，窗口会正常显示。如需自启动时最小化，需要手动添加 `--startup` 参数。

### 5.4 安装程序配置

安装程序会自动配置开机自启动选项，用户可在安装时选择是否启用。

---

## 6. 注意事项

### 6.1 参数优先级

- 命令行参数会覆盖配置文件中的设置
- 窗口大小和位置参数会保存到配置中
- 代理服务器参数会保存到配置中

### 6.2 配置持久化

以下参数在首次设置后会保存到配置文件，后续启动会继续使用：
- `--proxy-server`
- `--width` / `--height`
- 窗口位置（非 `--center`）

### 6.3 兼容性

- 所有参数均支持 Windows 10/11
- `--overlay` 需要 VR 头显支持
- `--disable-gpu` 可能影响性能，建议仅在必要时使用

### 6.4 故障排除

**问题：** 参数不生效
- 检查参数格式是否正确（注意 `=` 号）
- 确保参数在可执行文件名称之后
- 检查是否有引号包裹的路径问题

**问题：** GPU 加速禁用后性能下降
- 这是正常现象，软件渲染比硬件加速慢
- 如无必要，不要使用 `--disable-gpu`

**问题：** 自启动时窗口仍然显示
- 确认是否添加了 `--startup` 参数
- 检查注册表中的启动命令

---

## 7. 技术实现

### 7.1 参数解析流程

```
1. Rust 后端 (lib.rs) 解析命令行参数
2. 存储到 LaunchArgs 结构体
3. 通过 Tauri State 传递给前端
4. 前端 (app.js) 读取并应用参数
```

### 7.2 相关代码文件

- `src-tauri/src/lib.rs` - 参数解析和 Tauri 命令定义
- `src/platform/runtime.js` - 前端平台桥接层
- `src/app.js` - 应用入口，参数处理逻辑
- `Dotnet/TauriBackend/Program.cs` - .NET 侧边栏，自启动注册

### 7.3 数据结构

```rust
struct LaunchArgs {
    startup: bool,           // --startup / --minimized
    debug: bool,             // --debug
    overlay: bool,           // --overlay
    disable_gpu: bool,       // --disable-gpu
    center: bool,            // --center
    maximized: bool,         // --maximized
    fullscreen: bool,        // --fullscreen
    reset_window: bool,      // --reset-window
    config_directory: Option<String>,  // --config=
    proxy_server: Option<String>,      // --proxy-server=
    width: Option<u32>,      // --width=
    height: Option<u32>,     // --height=
    launch_command: Option<String>,    // vrcx:// URI
}
```

---

## 8. 更新日志

### v3.4.0
- 新增 `--minimized` 参数，作为 `--startup` 的别名
- 新增 `--maximized` 和 `--fullscreen` 参数，支持指定窗口显示状态
- 新增 `--reset-window` 参数，支持重置窗口尺寸和位置

### v3.3.0 (2025-09-19)
- 新增 `--width` 和 `--height` 参数，支持指定窗口大小
- 新增 `--center` 参数，支持窗口居中启动
- 新增 `--disable-gpu` 参数，支持禁用 GPU 加速
- 优化启动参数解析逻辑

### v3.2.0 (2025-09-18)
- 新增 `--startup` 参数，支持启动时最小化
- 新增 `--debug` 参数，支持调试模式
- 新增 `--overlay` 参数，支持 VR 覆盖模式
- 新增 `--config` 参数，支持自定义配置目录
- 新增 `--proxy-server` 参数，支持代理服务器

---

## 9. 相关文档

- [KNOWLEDGE_BASE.md](./KNOWLEDGE_BASE.md) - 项目知识库
- [MCP.md](./MCP.md) - MCP Server 文档

---

**最后更新：** 2026-09-24
