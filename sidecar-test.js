// 临时：模拟 Tauri 管道方式启动 sidecar，发送一条命令观察行为
const { spawn } = require('child_process');
const sidecar = 'F:\\Users\\12619\\Documents\\GitHub\\VRCX-Pro\\src-tauri\\target\\x86_64-pc-windows-gnu\\release\\sidecar\\VRCX-Sidecar.exe';
const p = spawn(sidecar, [], { stdio: ['pipe', 'pipe', 'pipe'] });
let outBuf = '', errBuf = '';
p.stdout.on('data', (d) => { outBuf += d.toString(); process.stdout.write('[OUT] ' + d.toString().trim() + '\n'); });
p.stderr.on('data', (d) => { errBuf += d.toString(); process.stdout.write('[ERR] ' + d.toString().trim() + '\n'); });
p.on('exit', (code, signal) => {
    console.log(`EXITED code=${code} signal=${signal}`);
    console.log('--- full stderr ---');
    console.log(errBuf.slice(0, 2000));
    process.exit(0);
});
setTimeout(() => {
    console.log('sending request...');
    p.stdin.write('{"id":1,"className":"SQLite","methodName":"ExecuteJson","args":["SELECT 1"]}\n');
}, 2000);
setTimeout(() => { console.log('10s watchdog: still running, stdout=' + outBuf.length + ' bytes'); p.kill(); }, 12000);
