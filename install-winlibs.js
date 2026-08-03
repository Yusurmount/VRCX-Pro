// 临时脚本：下载 winlibs (mingw-w64 gcc) 并解压到本机。
const https = require('https');
const { URL } = require('url');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DOWNLOAD_URL =
    'https://gh-proxy.com/https://github.com/brechtsanders/winlibs_mingw/releases/download/16.1.0posix-14.0.0-msvcrt-r4/winlibs-x86_64-posix-seh-gcc-16.1.0-mingw-w64msvcrt-14.0.0-r4.zip';
const DEST = path.join(process.env.USERPROFILE, 'mingw64');
const WORK = path.join(process.env.TEMP || '.', 'winlibs-dl');
const ZIP = path.join(WORK, 'winlibs.zip');

function getToFile(url, filePath) {
    return new Promise((resolve, reject) => {
        const req = https.get(
            url,
            { headers: { 'user-agent': 'vrcx-install' } },
            (res) => {
                if (
                    res.statusCode >= 300 &&
                    res.statusCode < 400 &&
                    res.headers.location
                ) {
                    res.resume();
                    resolve(getToFile(new URL(res.headers.location, url).toString(), filePath));
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`${url} -> HTTP ${res.statusCode}`));
                    res.resume();
                    return;
                }
                const total = parseInt(res.headers['content-length'] || '0', 10);
                let got = 0;
                const out = fs.createWriteStream(filePath);
                res.on('data', (c) => {
                    got += c.length;
                    if (total && got % (1 << 20) < 65536) {
                        console.log(
                            `  ${(got / 1048576).toFixed(1)}/${(total / 1048576).toFixed(1)} MB`
                        );
                    }
                });
                res.pipe(out);
                out.on('finish', () => out.close(resolve));
                out.on('error', reject);
            }
        );
        req.on('error', reject);
    });
}

(async () => {
    fs.mkdirSync(WORK, { recursive: true });
    if (!fs.existsSync(ZIP)) {
        console.log('downloading winlibs zip...');
        await getToFile(DOWNLOAD_URL, ZIP);
        console.log('saved ' + fs.statSync(ZIP).size + ' bytes');
    }
    console.log('extracting to ' + DEST);
    execSync(`tar -xf "${ZIP}" -C "${WORK}"`, { stdio: 'inherit' });
    const dir = fs
        .readdirSync(WORK)
        .find((d) => d.includes('mingw64'));
    if (!dir) throw new Error('mingw64 dir not found in archive');
    const src = path.join(WORK, dir);
    execSync(`xcopy "${src}\\*" "${DEST}\\" /E /I /Y /Q`, { stdio: 'inherit' });
    console.log('gcc: ' + path.join(DEST, 'bin', 'gcc.exe'));
    console.log('DONE');
})().catch((e) => {
    console.error('FAIL', e.message);
    process.exit(1);
});
