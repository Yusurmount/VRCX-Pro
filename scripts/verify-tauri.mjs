import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
const failures = [];

for (const dependency of ['electron', 'electron-builder', 'node-api-dotnet', 'hazardous']) {
    if (allDeps[dependency]) failures.push(`legacy dependency: ${dependency}`);
}
for (const directory of ['src-electron', 'src/ipc-electron']) {
    if (fs.existsSync(path.join(root, directory))) failures.push(`legacy directory: ${directory}`);
}
const legacyFiles = [
    'Dotnet/VRCX-Cef.csproj',
    'Dotnet/VRCX-Electron.csproj',
    'Dotnet/VRCX-Electron-arm64.csproj',
    'Dotnet/Cef',
    'Dotnet/AppApi/Cef',
    'Dotnet/AppApi/Electron',
    'Dotnet/Overlay/Cef',
    'Dotnet/Overlay/Electron'
];
for (const file of legacyFiles) {
    if (fs.existsSync(path.join(root, file))) failures.push(`legacy artifact: ${file}`);
}
const legacyBuildEntrypoints = [
    'build-windows-local.bat',
    'build-scripts/build-all.ps1',
    'build-scripts/dotnet/build-dotnet.cmd',
    'build-scripts/make-junction.cmd',
    'build-scripts/make-zip.cmd',
    'Installer/installer.nsi'
];
for (const file of legacyBuildEntrypoints) {
    if (fs.existsSync(path.join(root, file))) failures.push(`legacy build entrypoint: ${file}`);
}
if (packageJson.main) failures.push('package.json must not define an Electron main entry');
if (config.build?.frontendDist !== '../build/html') failures.push('unexpected Tauri frontendDist');
if (!config.bundle?.resources?.['../build/TauriBackend']) failures.push('Tauri .NET backend resource is missing');

if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
}
console.log('Tauri migration checks passed.');
