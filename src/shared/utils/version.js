function normalizeVersion(value) {
    return String(value || '')
        .replace(' (Linux)', '')
        .replace(/^VRCX-Pro(?:\s+Nightly)?\s+/, '')
        .replace(/^v/, '')
        .trim();
}

function getVersionParts(value) {
    const match = normalizeVersion(value).match(/\d+(?:\.\d+)*/);
    return match ? match[0].split('.').map(Number) : null;
}

// Build channel suffixes come from build-scripts/version-channel.cjs.
function getVersionChannel(value) {
    const normalized = normalizeVersion(value).toLowerCase();
    if (/-it(?:\.|$)/.test(normalized)) {
        return 'it';
    }
    if (/-beta(?:\.|$)/.test(normalized)) {
        return 'beta';
    }
    return 'release';
}

const CHANNEL_RANK = { it: 0, beta: 1, release: 2 };

function compareVersionNumbers(left, right) {
    const leftParts = getVersionParts(left);
    const rightParts = getVersionParts(right);
    if (!leftParts || !rightParts) {
        return null;
    }

    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
        const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
        if (difference !== 0) {
            return Math.sign(difference);
        }
    }
    // Same version number: release is newer than beta, beta newer than it.
    return Math.sign(
        CHANNEL_RANK[getVersionChannel(left)] -
            CHANNEL_RANK[getVersionChannel(right)]
    );
}

export { compareVersionNumbers, getVersionChannel, normalizeVersion };
