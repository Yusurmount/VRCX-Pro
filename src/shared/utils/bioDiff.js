/**
 * Rebuild the chronological bio version chain from feed_bio records.
 * Records are expected newest-first (as returned by getRecentBioChangesForUser).
 * @param {{ previousBio?: string|null, bio?: string|null, createdAt?: string|null }[]} records
 * @param {string|null|undefined} currentBio live bio, appended as the "current" version when it differs
 * @returns {{ bio: string, createdAt: string|null, isCurrent: boolean }[]} versions ascending in time
 */
function buildBioVersions(records, currentBio) {
    const list = Array.isArray(records) ? [...records].reverse() : [];
    const versions = [];

    /**
     * @param {string} bio
     * @param {string|null} createdAt
     * @param {boolean} isCurrent
     */
    const push = (bio, createdAt, isCurrent) => {
        const text = bio ?? '';
        const last = versions[versions.length - 1];
        if (last && last.bio === text) {
            return;
        }
        versions.push({ bio: text, createdAt, isCurrent });
    };

    for (const record of list) {
        if (versions.length === 0) {
            push(record.previousBio ?? '', record.createdAt ?? null, false);
        }
        push(record.bio ?? '', record.createdAt ?? null, false);
    }

    const live = currentBio ?? '';
    if (live !== '') {
        push(live, null, true);
    }
    return versions;
}

/**
 * Split text into lines. Empty text yields no lines.
 * @param {string} text
 * @returns {string[]}
 */
function splitLines(text) {
    const normalized = String(text ?? '').replace(/\r\n?/g, '\n');
    if (normalized === '') {
        return [];
    }
    return normalized.split('\n');
}

/**
 * Git-style line diff: LCS over lines after trimming common prefix/suffix.
 * @param {string} oldText
 * @param {string} newText
 * @returns {{ type: 'equal'|'del'|'add', text: string, oldLine: number|null, newLine: number|null }[]}
 */
function computeLineDiff(oldText, newText) {
    const oldLines = splitLines(oldText);
    const newLines = splitLines(newText);
    /** @type {{ type: 'equal'|'del'|'add', text: string, oldLine: number|null, newLine: number|null }[]} */
    const ops = [];

    let prefix = 0;
    while (
        prefix < oldLines.length &&
        prefix < newLines.length &&
        oldLines[prefix] === newLines[prefix]
    ) {
        prefix++;
    }

    let suffix = 0;
    while (
        suffix < oldLines.length - prefix &&
        suffix < newLines.length - prefix &&
        oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
    ) {
        suffix++;
    }

    for (let i = 0; i < prefix; i++) {
        ops.push({ type: 'equal', text: oldLines[i], oldLine: i + 1, newLine: i + 1 });
    }

    const oldMid = oldLines.slice(prefix, oldLines.length - suffix);
    const newMid = newLines.slice(prefix, newLines.length - suffix);
    const n = oldMid.length;
    const m = newMid.length;

    // dp[i][j] = LCS length of oldMid[i..n) and newMid[j..m)
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            dp[i][j] =
                oldMid[i] === newMid[j]
                    ? dp[i + 1][j + 1] + 1
                    : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }

    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (oldMid[i] === newMid[j]) {
            ops.push({
                type: 'equal',
                text: oldMid[i],
                oldLine: prefix + i + 1,
                newLine: prefix + j + 1
            });
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            ops.push({
                type: 'del',
                text: oldMid[i],
                oldLine: prefix + i + 1,
                newLine: null
            });
            i++;
        } else {
            ops.push({
                type: 'add',
                text: newMid[j],
                oldLine: null,
                newLine: prefix + j + 1
            });
            j++;
        }
    }
    while (i < n) {
        ops.push({
            type: 'del',
            text: oldMid[i],
            oldLine: prefix + i + 1,
            newLine: null
        });
        i++;
    }
    while (j < m) {
        ops.push({
            type: 'add',
            text: newMid[j],
            oldLine: null,
            newLine: prefix + j + 1
        });
        j++;
    }

    for (let k = 0; k < suffix; k++) {
        const oldIndex = oldLines.length - suffix + k;
        const newIndex = newLines.length - suffix + k;
        ops.push({
            type: 'equal',
            text: oldLines[oldIndex],
            oldLine: oldIndex + 1,
            newLine: newIndex + 1
        });
    }

    return ops;
}

export { buildBioVersions, computeLineDiff };
