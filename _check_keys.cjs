const fs = require('fs');
const path = require('path');

const en = JSON.parse(fs.readFileSync('src/localization/en.json', 'utf8'));
const enKeys = new Set();
(function flat(o, p) {
    for (const k in o) {
        const kk = p ? p + '.' + k : k;
        if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) flat(o[k], kk);
        else enKeys.add(kk);
    }
})(en, '');

const codeKeys = new Set();
(function walk(d) {
    for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        const st = fs.statSync(p);
        if (st.isDirectory()) {
            if (!/node_modules|dist|__tests__/.test(p)) walk(p);
        } else if (/\.(vue|js|ts)$/.test(f)) {
            const s = fs.readFileSync(p, 'utf8');
            for (const m of s.matchAll(/t\(\s*['"]([^'"$]{4,})['"]/g)) {
                if (!m[1].includes('+') && !m[1].endsWith('.') && !m[1].startsWith('{')) codeKeys.add(m[1]);
            }
        }
    }
})('src');

const miss = [...codeKeys].filter((k) => !enKeys.has(k));
console.log('code literal keys:', codeKeys.size, '| en keys:', enKeys.size, '| missing in en.json:', miss.length);
console.log(miss.sort().join('\n'));
