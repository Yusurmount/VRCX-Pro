@echo off
setlocal
cd /d "%~dp0.."

rem Ensure the Rust / MSVC toolchain is reachable (installed under G:\rust without PATH modification).
if exist "G:\rust\.cargo\bin\cargo.exe" (
    set "RUSTUP_HOME=G:\rust\.rustup"
    set "CARGO_HOME=G:\rust\.cargo"
    set "PATH=G:\rust\.cargo\bin;G:\VS2022BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64;G:\VS2022BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\Ninja;G:\rust\bin;%PATH%"
)

rem Read the canonical version from the root "Version" file and sync the configs to it.
for /f "delims=" %%v in ('node build-scripts\sync-version.js') do set "APPVER=%%v"
if "%APPVER%"=="" (
    echo [ERROR] could not read version from the Version file.
    exit /b 1
)

echo [VRCX-Pro] Building NSIS installer for version %APPVER% ...
call npm run tauri:build -- --bundles nsis
if errorlevel 1 (
    echo [ERROR] tauri build failed.
    exit /b 1
)

rem Move the built installer to the repo root.
set "OUT=src-tauri\target\release\bundle\nsis\VRCX-Pro_%APPVER%_x64-setup.exe"
if exist "%OUT%" (
    move /y "%OUT%" "VRCX-Pro_%APPVER%_x64-setup.exe" >nul
    echo [VRCX-Pro] Installer moved to repo root: VRCX-Pro_%APPVER%_x64-setup.exe
) else (
    echo [WARNING] installer not found at %OUT%
)

echo.
echo [VRCX-Pro] Installer output:
dir /b "VRCX-Pro_%APPVER%_x64-setup.exe" 2>nul || echo (none found)
endlocal
pause
