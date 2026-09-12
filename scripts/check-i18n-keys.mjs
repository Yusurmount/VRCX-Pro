import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'localization');
const fix = process.argv.includes('--fix');

/**
 * Look up a value by dotted path (e.g. "a.b.c") inside an object.
 * @param {object} obj
 * @param {string} dotted
 * @returns {unknown}
 */
function getByPath(obj, dotted) {
    return dotted.split('.').reduce((acc, k) => acc?.[k], obj);
}

/**
 * Insert a leaf value at a dotted path, creating intermediate objects as needed.
 * @param {object} obj
 * @param {string} dotted
 * @param {unknown} value
 */
function setByPath(obj, dotted, value) {
    const parts = dotted.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        if (!cur[k] || typeof cur[k] !== 'object' || Array.isArray(cur[k])) cur[k] = {};
        cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
}

/**
 * Collect all leaf keys as dotted paths.
 * @param {object} obj
 * @param {string} [prefix]
 * @returns {string[]}
 */
function collectKeys(obj, prefix = '') {
    const keys = [];
    for (const k in obj) {
        const kk = prefix ? `${prefix}.${k}` : k;
        const v = obj[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            keys.push(...collectKeys(v, kk));
        } else {
            keys.push(kk);
        }
    }
    return keys;
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
const enPath = path.join(dir, 'en.json');
const reference = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const referenceKeys = new Set(collectKeys(reference));

let hasIssues = false;

for (const f of files) {
    const filePath = path.join(dir, f);
    if (filePath === enPath) continue;

    const target = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const targetKeys = new Set(collectKeys(target));

    const missing = [...referenceKeys].filter((k) => !targetKeys.has(k));
    const extra = [...targetKeys].filter((k) => !referenceKeys.has(k));

    console.log(`\n=== ${f} ===`);
    console.log(`missing (in en.json but not ${f}): ${missing.length}`);
    for (const k of missing.sort()) {
        hasIssues = true;
        console.log(`  - ${k}`);
        if (fix) setByPath(target, k, getByPath(reference, k));
    }

    if (fix && missing.length) {
        fs.writeFileSync(filePath, `${JSON.stringify(target, null, 4)}\n`, 'utf8');
        console.log(`fixed ${missing.length} key(s) in ${f}`);
    }

    if (extra.length) {
        console.log(`extra (in ${f} but not en.json): ${extra.length}`);
        for (const k of extra.sort()) {
            console.log(`  + ${k}`);
        }
    }
}

console.log('\nDone.');
process.exit(hasIssues ? 1 : 0);
