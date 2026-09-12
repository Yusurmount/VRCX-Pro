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

echo [VRCX-Pro] Building portable (no installer) artifacts for version %APPVER% ...
call npm run tauri:build -- --no-bundle
if errorlevel 1 (
    echo [ERROR] tauri build failed.
    exit /b 1
)

set "REL=src-tauri\target\release"
set "STAGE=%REL%\portable"
set "ZIP=%REL%\VRCX-Pro-%APPVER%-portable.zip"

echo [VRCX-Pro] Assembling portable package ...
if exist "%STAGE%" rmdir /s /q "%STAGE%"
mkdir "%STAGE%"

copy "%REL%\vrcx-pro.exe" "%STAGE%\" >nul
if not exist "%REL%\dotnet-runtime" (
    echo [WARNING] dotnet-runtime not found in %REL%; the .NET backend will be unavailable in this portable build.
) else (
    xcopy "%REL%\dotnet-runtime" "%STAGE%\dotnet-runtime\" /e /i /q /y >nul
)

if exist "%ZIP%" del "%ZIP%"
tar -a -cf "%ZIP%" -C "%STAGE%" .
if errorlevel 1 (
    echo [ERROR] failed to create portable archive.
    exit /b 1
)

rem Move the portable archive to the repo root.
move /y "%ZIP%" "VRCX-Pro-%APPVER%-portable.zip" >nul
if errorlevel 1 (
    echo [WARNING] could not move portable archive to repo root.
) else (
    echo [VRCX-Pro] Portable package moved to repo root: VRCX-Pro-%APPVER%-portable.zip
)

echo.
echo [VRCX-Pro] Portable package: VRCX-Pro-%APPVER%-portable.zip
echo Note: portable builds require the Microsoft Edge WebView2 Runtime to be installed on the target machine.
endlocal
pause