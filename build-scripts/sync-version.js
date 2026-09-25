// Reads the canonical version and build channel, then synchronizes the
// channel-aware version into the Tauri configuration and Cargo manifest.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { readBuildVersion } = require('./version-channel.cjs');
let buildVersion;

try {
    buildVersion = readBuildVersion(root);
} catch (error) {
    console.error(`[sync-version] ERROR: ${error.message}.`);
    process.exit(1);
}

const { channel, version } = buildVersion;

// tauri.conf.json
const confPath = path.join(root, 'src-tauri', 'tauri.conf.json');
const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'));
conf.version = version;
fs.writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');

// Cargo.toml
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
const cargo = fs.readFileSync(cargoPath, 'utf8');
const versionPattern = /^[ \t]*version\s*=\s*"[^"]*"/m;
if (!versionPattern.test(cargo)) {
    console.error(
        '[sync-version] ERROR: no "version" line found in Cargo.toml.'
    );
    process.exit(1);
}
const nextCargo = cargo.replace(versionPattern, `version = "${version}"`);
fs.writeFileSync(cargoPath, nextCargo);

console.error(
    `[sync-version] channel: ${channel}; synced version to ${version}`
);
console.log(version);
