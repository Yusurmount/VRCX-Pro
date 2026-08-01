// Node script: verify all named imports can be resolved to named exports in target module.
// Reports: "file A (line N): import { X } from 'target' but target does not export X"
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

const ALIAS = { '@': SRC };

function resolvePath(importPath, fromFile) {
    // Resolve @/ alias
    for (const [alias, aliasPath] of Object.entries(ALIAS)) {
        if (importPath.startsWith(alias + '/')) {
            importPath = path.join(aliasPath, importPath.slice(alias.length + 1));
            break;
        }
    }
    // Relative path
    if (importPath.startsWith('.')) {
        importPath = path.resolve(path.dirname(fromFile), importPath);
    }
    // Find actual file (try .js, .jsx, .vue, /index.js, /index.jsx)
    const tryExts = ['', '.js', '.jsx', '.vue', '/index.js', '/index.jsx'];
    for (const ext of tryExts) {
        const candidate = importPath + ext;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return candidate;
        }
    }
    return null; // not found
}

// Collect all .vue/.js/.jsx files
function walkDir(dir, result = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'dist-vue' || entry.name === 'build') continue;
            walkDir(full, result);
        } else if (/\.(vue|js|jsx)$/.test(entry.name)) {
            result.push(full);
        }
    }
    return result;
}

// Parse named export names from a target file's raw content
function parseExportNames(filePath, cache = new Map(), stack = []) {
    if (cache.has(filePath)) return cache.get(filePath);
    // Cycle protection
    const normPath = path.normalize(filePath);
    if (stack.includes(normPath)) return new Set();
    stack.push(normPath);

    const content = fs.readFileSync(filePath, 'utf8');
    const names = new Set();

    // 1) export function/const/let/var/class/async function NAME
    const declRe = /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;
    let m;
    while ((m = declRe.exec(content)) !== null) names.add(m[1]);

    // 2) export default <name>? (ignored - named imports don't use this)

    // 3) export { a, b, c as d }
    const blockRe = /export\s*\{([^}]*)\}\s*(?:;|\n|from)/g;
    while ((m = blockRe.exec(content)) !== null) {
        const body = m[1];
        const itemRe = /([A-Za-z_$][\w$]*)\s*(?:\s+as\s+([A-Za-z_$][\w$]*))?/g;
        let item;
        while ((item = itemRe.exec(body)) !== null) {
            // Only count as direct export if NOT followed by "from" (i.e. re-export from external)
            // For now just always add the "as" name or original
            names.add(item[2] || item[1]);
        }
    }

    // 4) export { a, b, c } from 'other' (re-export list names)
    //    Already captured by #3 with the 'from' optional; we added the names above

    // 5) export * from 'other' (re-export ALL named from other). Resolve those too.
    const starRe = /export\s*\*\s*from\s*['"]([^'"]+)['"]\s*;?/g;
    while ((m = starRe.exec(content)) !== null) {
        const otherPath = resolvePath(m[1], filePath);
        if (otherPath) {
            const otherNames = parseExportNames(otherPath, cache, stack);
            for (const n of otherNames) names.add(n);
        }
    }

    // 6) export { X, Y, Z } from 'other' — names captured in #3 already; but they may be from OTHER file, not defined here.
    //    For import resolution purposes, this file DOES re-export those names, so we should keep them.

    cache.set(filePath, names);
    stack.pop();
    return names;
}

// Parse named imports from file content. Returns [{names: [], from: string, line: N}]
function parseNamedImports(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const result = [];
    // Regex for: import { X, Y as Z } from 'path'
    // Need to handle multi-line since sometimes imports span multiple lines
    const importRe = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g;
    let m;
    while ((m = importRe.exec(content)) !== null) {
        // Find line number (approximate - use the position)
        const pos = m.index;
        const lineNum = content.slice(0, pos).split('\n').length;
        const block = m[1];
        const names = [];
        const itemRe = /([A-Za-z_$][\w$]*)\s*(?:\s+as\s+([A-Za-z_$][\w$]*))?/g;
        let item;
        while ((item = itemRe.exec(block)) !== null) {
            // imported alias name or original name
            names.push({ local: item[2] || item[1], imported: item[1] });
        }
        result.push({
            line: lineNum,
            from: m[2],
            imports: names
        });
    }
    return result;
}

// === MAIN ===
const allFiles = walkDir(SRC);
console.log(`Scanning ${allFiles.length} source files...`);

const fileCache = new Map();
let issuesCount = 0;
const seenIssues = new Set();

for (const file of allFiles) {
    const importBlocks = parseNamedImports(file);
    for (const blk of importBlocks) {
        // Skip external (non-local) imports: vue, pinia, lucide-vue-next, etc.
        if (!blk.from.startsWith('.') && !blk.from.startsWith('@/')) continue;
        // Skip type-only markers if any
        const resolvedTarget = resolvePath(blk.from, file);
        if (!resolvedTarget) continue; // Skip unresolved file path (not our scope)
        const exports = parseExportNames(resolvedTarget, fileCache);
        const relFile = path.relative(ROOT, file);
        const relTarget = path.relative(ROOT, resolvedTarget);
        for (const imp of blk.imports) {
            // The "imported" name is what we expect target to export
            if (!exports.has(imp.imported)) {
                const key = `${relFile}:${blk.line}:${imp.imported}:${relTarget}`;
                if (seenIssues.has(key)) continue;
                seenIssues.add(key);
                console.log(`[MISSING EXPORT] ${relFile}:${blk.line}`);
                console.log(`             import { ${imp.imported}${imp.local !== imp.imported ? ' as ' + imp.local : ''} } from '${blk.from}'`);
                console.log(`             target (${relTarget}) does NOT have named export: ${imp.imported}`);
                issuesCount++;
            }
        }
    }
}

console.log(`\n=== TOTAL ISSUES: ${issuesCount} ===`);
process.exit(issuesCount > 0 ? 1 : 0);
