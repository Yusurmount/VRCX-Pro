// Reads the canonical version from the root "Version" file and synchronizes it
// into src-tauri/tauri.conf.json and src-tauri/Cargo.toml, so the produced
// installer/artifacts always carry the same version.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const version = fs.readFileSync(path.join(root, 'Version'), 'utf8').trim();
if (!version) {
  console.error('[sync-version] ERROR: the root "Version" file is empty.');
  process.exit(1);
}

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
  console.error('[sync-version] ERROR: no "version" line found in Cargo.toml.');
  process.exit(1);
}
const nextCargo = cargo.replace(versionPattern, `version = "${version}"`);
fs.writeFileSync(cargoPath, nextCargo);

console.error(`[sync-version] synced version to ${version}`);
console.log(version);
