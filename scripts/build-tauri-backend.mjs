import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const project = path.join(rootDir, 'Dotnet', 'TauriBackend', 'VRCX-TauriBackend.csproj');
const outputDir = path.join(rootDir, 'build', 'TauriBackend');
const version = fs.readFileSync(path.join(rootDir, 'Version'), 'utf8').trim();
const ridByPlatform = {
    win32: { x64: 'win-x64', arm64: 'win-arm64' },
    darwin: { x64: 'osx-x64', arm64: 'osx-arm64' },
    linux: { x64: 'linux-x64', arm64: 'linux-arm64' }
};
const rid = ridByPlatform[process.platform]?.[process.arch];

if (!rid) {
    console.error(`No .NET publish runtime identifier for ${process.platform}/${process.arch}`);
    process.exit(1);
}

// Do not delete the output directory: `tauri dev` compiles the Rust side
// concurrently with this script, and the tauri build script validates that the
// configured resource (`../build/TauriBackend`) exists. `dotnet publish -o`
// overwrites the directory contents in place.
const selfContained = !process.argv.includes('--framework-dependent');
const result = spawnSync(
    'dotnet',
    [
        'publish',
        project,
        '-c',
        'Release',
        '-r',
        rid,
        '--self-contained',
        String(selfContained),
        '-p:Version=' + version,
        '-o',
        outputDir
    ],
    { stdio: 'inherit' }
);

// Framework-dependent builds must not contain native .NET hosting DLLs
// (hostfxr, hostpolicy, coreclr, clrjit). If these are left over from a
// previous self-contained publish, the .NET host uses them instead of the
// system-installed runtime and then fails to locate the framework in the
// app-local probe path ("No frameworks were found").
if (!selfContained && result.status === 0) {
    for (const dll of ['hostfxr.dll', 'hostpolicy.dll', 'coreclr.dll', 'clrjit.dll']) {
        const p = path.join(outputDir, dll);
        if (fs.existsSync(p)) fs.unlinkSync(p);
    }
}

process.exit(result.status ?? 1);
