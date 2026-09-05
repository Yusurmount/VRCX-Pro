import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const project = path.join(rootDir, 'Dotnet', 'TauriBackend', 'VRCX-TauriBackend.csproj');
const outputDir = path.join(rootDir, 'build', 'TauriBackend');
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

const resolvedOutput = path.resolve(outputDir);
if (!resolvedOutput.startsWith(path.resolve(rootDir) + path.sep)) {
    console.error('Refusing to clean a backend output directory outside the repository');
    process.exit(1);
}
if (fs.existsSync(resolvedOutput)) {
    fs.rmSync(resolvedOutput, { recursive: true, force: true });
}

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
        '-o',
        outputDir
    ],
    { stdio: 'inherit' }
);
process.exit(result.status ?? 1);
