const fs = require('fs');
const path = require('path');

const channelConfigurations = new Map([
    ['release', { name: 'Release', suffix: '' }],
    ['beta', { name: 'Beta', suffix: '-beta' }],
    ['it', { name: 'It', suffix: '-it' }]
]);

function getVersionForChannel(baseVersion, channelValue) {
    const base = baseVersion.trim();
    const channel = channelValue.trim();
    const configuration = channelConfigurations.get(channel.toLowerCase());

    if (!base) {
        throw new Error('the root "Version" file is empty');
    }
    if (!configuration) {
        throw new Error(
            `unsupported version channel ${JSON.stringify(channel)}; expected Release, Beta, or It`
        );
    }

    return {
        channel: configuration.name,
        version: `${base}${configuration.suffix}`
    };
}

function readBuildVersion(root = path.join(__dirname, '..')) {
    const baseVersion = fs
        .readFileSync(path.join(root, 'Version'), 'utf8')
        .trim();
    const channel = fs
        .readFileSync(path.join(root, 'version_channel'), 'utf8')
        .trim();

    return {
        baseVersion,
        ...getVersionForChannel(baseVersion, channel)
    };
}

module.exports = {
    getVersionForChannel,
    readBuildVersion
};
