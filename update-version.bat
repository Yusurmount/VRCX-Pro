@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

rem 一键更新根目录 Version 规范版本号，并同步到 src-tauri 配置。
rem 用法: update-version.bat [1|2|3 或 patch|minor|major]；不带参数则显示菜单。

if not exist "Version" (
    echo [ERROR] 未找到 Version 文件
    exit /b 1
)

set "CURRENT="
set /p "CURRENT="<"Version"
for /f "tokens=1-3 delims=." %%a in ("!CURRENT!") do (
    set "MAJOR=%%a"
    set "MINOR=%%b"
    set "PATCH=%%c"
)

set "VALID=1"
if not defined PATCH set "VALID=0"
for /f "delims=0123456789" %%x in ("!MAJOR!!MINOR!!PATCH!") do set "VALID=0"
if "!VALID!"=="0" (
    echo [ERROR] Version 格式无效，应为 x.y.z，当前值: !CURRENT!
    exit /b 1
)

set /a BUMP_PATCH=PATCH + 1
set /a BUMP_MINOR=MINOR + 1
set /a BUMP_MAJOR=MAJOR + 1

set "CHOICE=%~1"
if defined CHOICE goto :apply

echo 当前版本: !CURRENT!
echo   [1] 小版本 (patch): !CURRENT! → !MAJOR!.!MINOR!.!BUMP_PATCH!
echo   [2] 中版本 (minor): !CURRENT! → !MAJOR!.!BUMP_MINOR!.0
echo   [3] 大版本 (major): !CURRENT! → !BUMP_MAJOR!.0.0
echo   [0] 取消
set "CHOICE="
set /p "CHOICE=请选择 [0-3]: "
if not defined CHOICE goto :cancel

:apply
set "NEW="
if /i "!CHOICE!"=="1" set "NEW=!MAJOR!.!MINOR!.!BUMP_PATCH!"
if /i "!CHOICE!"=="patch" set "NEW=!MAJOR!.!MINOR!.!BUMP_PATCH!"
if /i "!CHOICE!"=="2" set "NEW=!MAJOR!.!BUMP_MINOR!.0"
if /i "!CHOICE!"=="minor" set "NEW=!MAJOR!.!BUMP_MINOR!.0"
if /i "!CHOICE!"=="3" set "NEW=!BUMP_MAJOR!.0.0"
if /i "!CHOICE!"=="major" set "NEW=!BUMP_MAJOR!.0.0"
if /i "!CHOICE!"=="0" goto :cancel
if /i "!CHOICE!"=="q" goto :cancel
if not defined NEW (
    echo [ERROR] 无效选项: !CHOICE!
    exit /b 1
)

set /p "=%NEW%"<nul >"Version"
echo [OK] Version 已更新: !CURRENT! → !NEW!

node build-scripts\sync-version.js >nul
if errorlevel 1 (
    echo [ERROR] 同步 tauri.conf.json / Cargo.toml 失败，Version 已写入 !NEW!
    exit /b 1
)
echo [OK] 已同步到 src-tauri\tauri.conf.json 与 src-tauri\Cargo.toml
exit /b 0

:cancel
echo 已取消，未修改版本号。
exit /b 0
