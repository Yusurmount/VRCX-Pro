const fs = require('node:fs');

const overridePath = 'build-scripts/licenses/nuget-overrides.json';
const overrides = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
for (const key of Object.keys(overrides)) {
    if (key.includes('CefSharp') || key.includes('Microsoft.JavaScript.NodeApi')) {
        delete overrides[key];
    }
}
fs.writeFileSync(overridePath, `${JSON.stringify(overrides, null, 4)}\n`, 'utf8');

for (const file of [
    'src/components/AdvancedMaterialBackground.vue',
    'src/services/export.js',
    'src/stores/vrcx.js',
    'src/stores/vrcStatus.js',
    'src/vr/Vr.vue',
    'src/views/Tools/dialogs/RegistryBackupDialog.vue'
]) {
    let source = fs.readFileSync(file, 'utf8');
    source = source
        .replaceAll('Electron', 'native desktop')
        .replaceAll('electron', 'nativeDesktop')
        .replaceAll('CefSharp', 'native WebView');
    fs.writeFileSync(file, source, 'utf8');
}
