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
    return 0;
}

export { compareVersionNumbers, normalizeVersion };
