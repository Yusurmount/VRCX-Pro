@echo off
setlocal
cd /d "%~dp0"

rem One-click version bumper: updates the root "Version" file, then syncs
rem src-tauri config via build-scripts/sync-version.js.
rem Usage: update-version.bat [patch|minor|major|1|2|3|0]

if not exist "Version" (
    echo [ERROR] Version file not found.
    exit /b 1
)

set "CURRENT="
set /p "CURRENT="<"Version"

for /f "tokens=1-3 delims=." %%a in ("%CURRENT%") do (
    set "MAJOR=%%a"
    set "MINOR=%%b"
    set "PATCH=%%c"
)

set "VALID=1"
if not defined PATCH set "VALID=0"
for /f "delims=0123456789" %%x in ("%MAJOR%%MINOR%%PATCH%") do set "VALID=0"
if "%VALID%"=="0" (
    echo [ERROR] Bad Version format, expected x.y.z : "%CURRENT%"
    exit /b 1
)

set /a BUMP_PATCH=PATCH + 1
set /a BUMP_MINOR=MINOR + 1
set /a BUMP_MAJOR=MAJOR + 1

set "CHOICE=%~1"
if defined CHOICE goto :apply

echo Current version: %CURRENT%
echo   [1] patch : %CURRENT% to %MAJOR%.%MINOR%.%BUMP_PATCH%
echo   [2] minor : %CURRENT% to %MAJOR%.%BUMP_MINOR%.0
echo   [3] major : %CURRENT% to %BUMP_MAJOR%.0.0
echo   [0] cancel
set "CHOICE="
set /p "CHOICE=Select [0-3]: "
if not defined CHOICE goto :cancel

:apply
set "NEW="
if /i "%CHOICE%"=="1" set "NEW=%MAJOR%.%MINOR%.%BUMP_PATCH%"
if /i "%CHOICE%"=="patch" set "NEW=%MAJOR%.%MINOR%.%BUMP_PATCH%"
if /i "%CHOICE%"=="2" set "NEW=%MAJOR%.%BUMP_MINOR%.0"
if /i "%CHOICE%"=="minor" set "NEW=%MAJOR%.%BUMP_MINOR%.0"
if /i "%CHOICE%"=="3" set "NEW=%BUMP_MAJOR%.0.0"
if /i "%CHOICE%"=="major" set "NEW=%BUMP_MAJOR%.0.0"
if /i "%CHOICE%"=="0" goto :cancel
if /i "%CHOICE%"=="q" goto :cancel
if not defined NEW (
    echo [ERROR] Invalid option: %CHOICE%
    exit /b 1
)

set /p "=%NEW%"<nul >"Version"
echo [OK] Version updated: %CURRENT% to %NEW%

node build-scripts\sync-version.js >nul
if errorlevel 1 (
    echo [ERROR] sync-version.js failed; Version already written: %NEW%
    exit /b 1
)
echo [OK] Synced to src-tauri\tauri.conf.json and src-tauri\Cargo.toml
exit /b 0

:cancel
echo Cancelled. Version unchanged.
exit /b 0
