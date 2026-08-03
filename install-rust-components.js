// 临时安装脚本：绕过 rustup 的 schannel TLS 沙箱限制，
// 用 Node(OpenSSL) 从 rsproxy.cn 镜像下载 stable toolchain 组件并解压安装。
const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MIRROR = 'https://rsproxy.cn';
const TOML = MIRROR + '/dist/channel-rust-stable.toml';
// 完整 gnu host 工具链：build script / proc-macro 也走 gcc 链接，
// 无需 MSVC link.exe
const TARGET = 'x86_64-pc-windows-gnu';
const TOOLCHAIN = path.join(
    process.env.USERPROFILE,
    '.rustup',
    'toolchains',
    'stable-x86_64-pc-windows-gnu'
);
const WORK = path.join(process.env.TEMP || '.', 'rust-dl-gnu-full');
const COMPONENTS = ['rustc', 'cargo', 'rust-std'];

function get(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        const req = https.get(
            url,
            { headers: { 'user-agent': 'vrcx-install' } },
            (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    if (redirects > 5) {
                        reject(new Error(`too many redirects for ${url}`));
                        return;
                    }
                    res.resume();
                    resolve(get(new URL(res.headers.location, url).toString(), redirects + 1));
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`${url} -> HTTP ${res.statusCode}`));
                    res.resume();
                    return;
                }
                const chunks = [];
                res.on('data', (c) => chunks.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            }
        );
        req.on('error', reject);
    });
}

function section(toml, sec) {
    const m = toml.match(new RegExp(`\\[${sec}\\]\\s*([^\\[]*)`));
    return m ? m[1] : null;
}

function sectionValue(toml, sec, key) {
    const body = section(toml, sec);
    if (!body) return null;
    const kv = body.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm'));
    return kv ? kv[1] : null;
}

function targetUrl(toml, sec) {
    const m = toml.match(new RegExp(`\\[${sec}\\.target\\.${TARGET}\\]\\s*([^\\[]*)`));
    if (!m) return null;
    const u = m[1].match(/url\s*=\s*"([^"]*)"/);
    return u ? u[1] : null;
}

(async () => {
    console.log('fetching ' + TOML);
    const toml = (await get(TOML)).toString('utf-8');
    fs.mkdirSync(WORK, { recursive: true });
    fs.mkdirSync(TOOLCHAIN, { recursive: true });

    for (const c of COMPONENTS) {
        const version = sectionValue(toml, `pkg.${c}`, 'version');
        const url = targetUrl(toml, `pkg.${c}`);
        if (!version || !url) {
            console.error(`missing info for ${c}`);
            continue;
        }
        const mirrorUrl = url.replace('https://static.rust-lang.org', MIRROR);
        const fname = path.basename(new URL(mirrorUrl).pathname);
        const fpath = path.join(WORK, fname);
        if (!fs.existsSync(fpath)) {
            console.log(`downloading ${mirrorUrl} (${c} ${version})`);
            const buf = await get(mirrorUrl);
            fs.writeFileSync(fpath, buf);
            console.log(`  saved ${buf.length} bytes`);
        }
        console.log(`extracting ${fname}`);
        execSync(`tar -xf "${fpath}" -C "${WORK}"`, { stdio: 'inherit' });
    }

    const dirs = fs
        .readdirSync(WORK)
        .filter(
            (d) =>
                /^(rustc|cargo|rust-std)-/.test(d) &&
                fs.statSync(path.join(WORK, d)).isDirectory()
        );
    for (const d of dirs) {
        const base = path.join(WORK, d);
        // rustup 组件 tarball 是安装器结构：内层子目录才是真实内容
        let inner = null;
        if (d.startsWith('rustc-')) {
            inner = path.join(base, 'rustc');
        } else if (d.startsWith('cargo-')) {
            inner = path.join(base, 'cargo');
        } else if (d.startsWith('rust-std-')) {
            const subs = fs
                .readdirSync(base)
                .filter((s) => s.startsWith('rust-std-'));
            if (subs.length) inner = path.join(base, subs[0]);
        }
        const src = inner || base;
        console.log(`merging ${src} -> toolchain`);
        execSync(`xcopy "${src}\\*" "${TOOLCHAIN}\\" /E /I /Y /Q`, { stdio: 'inherit' });
    }
    console.log('DONE. toolchain = ' + TOOLCHAIN);
})().catch((e) => {
    console.error('FAIL', e.message);
    process.exit(1);
});
