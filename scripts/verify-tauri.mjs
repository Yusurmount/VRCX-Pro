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
if (packageJson.main) failures.push('package.json must not define an Electron main entry');
if (config.build?.frontendDist !== '../build/html') failures.push('unexpected Tauri frontendDist');
if (!config.bundle?.resources?.['../build/TauriBackend']) failures.push('Tauri .NET backend resource is missing');

if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
}
console.log('Tauri migration checks passed.');
