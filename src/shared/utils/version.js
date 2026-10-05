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
// Accepts both `3.7.2-beta.1` and `3.7.2-beta1`; the trailing build number
// is captured so pre-releases of the same number can be ordered.
function getChannelSuffix(value) {
    const normalized = normalizeVersion(value).toLowerCase();
    const match = normalized.match(/-(beta|it)(?:[.-]?(\d+))?$/);
    if (!match) {
        return { channel: 'release', build: 0 };
    }
    return {
        channel: match[1],
        build: match[2] ? Number(match[2]) : 0
    };
}

function getVersionChannel(value) {
    return getChannelSuffix(value).channel;
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
    // Same version number: release is newer than beta, beta newer than it;
    // within the same channel a larger suffix build number is newer
    // (3.7.2-beta.2 > 3.7.2-beta.1).
    const leftSuffix = getChannelSuffix(left);
    const rightSuffix = getChannelSuffix(right);
    const channelDifference =
        CHANNEL_RANK[leftSuffix.channel] - CHANNEL_RANK[rightSuffix.channel];
    if (channelDifference !== 0) {
        return Math.sign(channelDifference);
    }
    return Math.sign(leftSuffix.build - rightSuffix.build);
}

export { compareVersionNumbers, getVersionChannel, normalizeVersion };
