<#
.SYNOPSIS
    VRCX-Pro (Tauri) 安装版构建脚本。

.DESCRIPTION
    一键构建 NSIS 安装器（内嵌前端资源与 C# sidecar）。

    构建流程：
      1. 编译 C# sidecar (Dotnet/VRCX-Sidecar.csproj -> build/Sidecar/)
      2. 构建前端 (npm run prod -> build/html)
      3. tauri build -> NSIS 安装器 (src-tauri/target/release/bundle/nsis/VRCX-Pro_*.exe)

    前置依赖：
      - .NET SDK（编译 sidecar）
      - Node.js / npm（构建前端）
      - Rust 工具链 + mingw-w64 gcc（cargo build）
      - @tauri-apps/cli（tauri build，npm i -D @tauri-apps/cli）

.EXAMPLE
    .\build-tauri.ps1
#>
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

# ---- 0) 同步版本号（以 Version 文件为准，tauri.conf.json / package.json / Cargo.toml 自动跟随） ----
$version = (Get-Content (Join-Path $Root "Version") -Raw).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw "Version 文件格式无效：$version" }
$targets = @(
    (Join-Path $Root "src-tauri\tauri.conf.json"),
    (Join-Path $Root "package.json"),
    (Join-Path $Root "src-tauri\Cargo.toml")
)
foreach ($target in $targets) {
    $text = [System.IO.File]::ReadAllText($target)
    if ($target -like "*Cargo.toml") {
        # Cargo.toml：仅同步 [package] 段的 version，避免误改依赖版本
        $lines = $text -split "`n"
        $inPackage = $false
        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = $lines[$i]
            if ($line -match '^\s*\[') {
                $inPackage = $line -match '^\[package\]'
            }
            elseif ($inPackage -and $line -match '^version\s*=\s*"[^"]*"') {
                $suffix = if ($line -match '\r$') { "`r" } else { "" }
                $lines[$i] = 'version = "' + $version + '"' + $suffix
            }
        }
        $updated = $lines -join "`n"
    } else {
        $updated = $text -replace '"version"\s*:\s*"[^"]*"', ('"version": "' + $version + '"')
    }
    if ($updated -ne $text) {
        [System.IO.File]::WriteAllText($target, $updated, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "已同步版本: $target -> $version" -ForegroundColor Yellow
    }
}

# ---- 1) 工具链 PATH（未配置时自动补 rustup / mingw 常用位置） ----
$extraBins = @(
    "$env:USERPROFILE\.cargo\bin",
    "$env:USERPROFILE\.rustup\toolchains\stable-x86_64-pc-windows-gnu\bin",
    "$env:USERPROFILE\mingw64\bin"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
$env:PATH = (@($extraBins) + @($env:PATH)) -join ';'

foreach ($tool in 'dotnet', 'node', 'npm', 'cargo') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "缺少依赖：$tool 不在 PATH 中"
    }
}

# 调用外部命令的辅助函数：PS 5.1 中 $ErrorActionPreference = "Stop" 会把外部命令的
# stderr 输出（如 vite/cargo 的警告）当成终止错误（NativeCommandError），即使命令成功。
# 这里临时降级 EAP，改以 $LASTEXITCODE 判断成败。
function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)][scriptblock]$Command,
        [string]$StepName
    )
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $Command
        if ($LASTEXITCODE -ne 0) { throw "$StepName 失败 (exit $LASTEXITCODE)" }
    }
    finally {
        $ErrorActionPreference = $prev
    }
}

# 定位 tauri CLI（全局命令 或 项目 node_modules/.bin）
$tauriCmd = Get-Command tauri -ErrorAction SilentlyContinue
if (-not $tauriCmd) {
    $localTauri = Join-Path $Root "node_modules\.bin\tauri.cmd"
    if (Test-Path $localTauri) {
        $tauriCmd = $localTauri
    } else {
        throw "未找到 tauri CLI。请先安装：npm i -D @tauri-apps/cli"
    }
}

# ---- 1) 编译 C# sidecar ----
Write-Host "[1/3] 编译 C# sidecar ..." -ForegroundColor Cyan
Push-Location $Root
try {
    Invoke-Native -Command { dotnet build "Dotnet\VRCX-Sidecar.csproj" -c Release -p:Platform=x64 -p:WarningLevel=0 -v m } -StepName "sidecar 编译"
}
finally { Pop-Location }

# ---- 2) 构建前端（vite build -> build/html，tauri 打包时嵌入） ----
Write-Host "[2/3] 构建前端 (vite build) ..." -ForegroundColor Cyan
Push-Location $Root
try {
    Invoke-Native -Command { npm run prod } -StepName "前端构建"
}
finally { Pop-Location }

# ---- 3) Tauri 打包（NSIS 安装器） ----
Write-Host "[3/3] tauri build ..." -ForegroundColor Cyan
# bundler 工具（NSIS 等）缓存到项目内，避免写入 AppData 受限目录
$env:TAURI_BUNDLER_TOOLS_CACHE = Join-Path $Root ".tauri-cache"
Push-Location (Join-Path $Root "src-tauri")
try {
    Invoke-Native -Command { & $tauriCmd build } -StepName "tauri build"
}
finally { Pop-Location }

# ---- 4) 输出产物（移动到项目根目录） ----
Write-Host "`n构建完成：" -ForegroundColor Green
$nsisDir = Join-Path $Root "src-tauri\target\release\bundle\nsis"
$installers = Get-ChildItem $nsisDir -Filter *.exe -ErrorAction SilentlyContinue
if ($installers) {
    foreach ($installer in $installers) {
        $dest = Join-Path $Root $installer.Name
        # PS 5.1 的 Move-Item -Force 不覆盖已存在文件，先移除旧产物
        Remove-Item -Path $dest -Force -ErrorAction SilentlyContinue
        Move-Item -Path $installer.FullName -Destination $dest
        Write-Host "  安装器: $dest"
    }
} else {
    Write-Host "  未找到安装器，请检查 tauri build 日志"
}
