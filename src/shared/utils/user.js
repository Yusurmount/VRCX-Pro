import { HueToHex } from './base/ui';
import { convertFileUrlToImageUrl } from './common';
import { languageMappings } from '../constants/language';
import { removeEmojis } from './base/string';
import { timeToText } from './base/format';
import { parseLocation } from './locationParser';

const THEME_COLOR_LIMITS = Object.freeze({
    darkMinLuminance: 0.42,
    lightMaxLuminance: 0.74
});

const ONLINE_STATUSES = Object.freeze([
    'active',
    'join me',
    'ask me',
    'busy'
]);

/**
 * 生成「展示用」的在线版用户对象（浅拷贝，不改动原 ref）。
 * @param {object} user
 * @param {string} location 真实位置
 * @param {number} [joinTime] 本地在场证据的进入时间
 * @returns {object}
 */
function deriveOnlinePresence(user, location, joinTime) {
    const L = parseLocation(location);
    const derived = {
        ...user,
        state: 'online',
        status: ONLINE_STATUSES.includes(user.status) ? user.status : 'active',
        location,
        worldId: L.worldId,
        instanceId: L.instanceId,
        $location: L
    };
    if (joinTime) {
        derived.$online_for = joinTime;
        derived.$location_at = joinTime;
    }
    return derived;
}

/**
 * 解析用于展示的用户在线状态。
 *
 * VRChat 的 GET /users/{userId} 对非好友可能把 state/status/location 一律
 * 返回 offline（即使对方在线）。游戏日志的当前实例玩家列表能证明对方就在我
 * 的房间里，此时用本地在场证据补全展示值。好友与本人一律返回原值，
 * 避免绕过 pendingOffline 等好友状态机。
 *
 * @param {object} user 用户 ref
 * @param {{isSelf?: boolean, gameRunning?: boolean, inMyInstance?: boolean, myLocation?: string, joinTime?: number}} evidence 本地在场证据
 * @returns {object} 展示用用户对象（有派生时为浅拷贝，否则原样返回）
 */
function resolveUserPresence(user, evidence = {}) {
    if (!user || user.isFriend || evidence.isSelf) {
        return user;
    }
    const state = user.state || '';
    const location = user.location || '';
    if (state === 'online' || state === 'active') {
        return user;
    }
    if (location && location !== 'offline') {
        // 位置是真实的 → 说明在线，修正可能被门控成 offline 的 state/status
        if (state === 'offline' || !state) {
            return deriveOnlinePresence(user, location);
        }
        return user;
    }
    // 接口整段返回 offline → 用本地在场证据兜底
    const { gameRunning, inMyInstance, myLocation, joinTime } = evidence;
    if (!gameRunning || !inMyInstance || !myLocation) {
        return user;
    }
    const L = parseLocation(myLocation);
    if (L.isOffline || L.isTraveling) {
        return user;
    }
    return deriveOnlinePresence(user, myLocation, joinTime);
}

/**
 * 判断（展示解析后的）用户是否在线。
 * @param {object} user
 * @returns {boolean}
 */
function isPresenceOnline(user) {
    if (!user) {
        return false;
    }
    if (user.state === 'online' || user.state === 'active') {
        return true;
    }
    return Boolean(user.location) && user.location !== 'offline';
}

/**
 *
 * @param {object} ctx
 * @returns {string?}
 */
function userOnlineForTimestamp(ctx) {
    if (ctx.ref.state === 'online' && ctx.ref.$online_for) {
        return new Date(ctx.ref.$online_for).toJSON();
    } else if (ctx.ref.state === 'active' && ctx.ref.$active_for) {
        return new Date(ctx.ref.$active_for).toJSON();
    } else if (ctx.ref.$offline_for) {
        return new Date(ctx.ref.$offline_for).toJSON();
    }
    return null;
}

/**
 *
 * @param {string} language
 * @returns
 */
function languageClass(language) {
    const style = {};
    const mapping = languageMappings[language];
    if (typeof mapping !== 'undefined') {
        style[mapping] = true;
    } else {
        style.unknown = true;
    }
    return style;
}

/**
 *
 * @param {string} userId
 * @param {boolean} isDarkMode
 * @returns
 */
async function getNameColour(userId, isDarkMode) {
    const hue = await AppApi.GetColourFromUserID(userId);
    return HueToHex(hue, isDarkMode);
}

/**
 * @param {string} value
 * @returns {string | null}
 */
function normalizeProfileHex(value) {
    const hex = String(value || '')
        .trim()
        .replace(/^#/, '')
        .toLowerCase();
    if (!/^[0-9a-f]{6}$/.test(hex)) {
        return null;
    }
    return `#${hex}`;
}

/**
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number } | null}
 */
function hexToRgb(hex) {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!match) {
        return null;
    }
    const value = match[1];
    return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16)
    };
}

/**
 * @param {{ r: number, g: number, b: number }} rgb
 * @returns {string}
 */
function rgbToHex(rgb) {
    const toHex = (value) => {
        const n = Math.max(0, Math.min(255, Math.round(value)));
        return n.toString(16).padStart(2, '0');
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * @param {{ r: number, g: number, b: number }} rgb
 * @returns {number}
 */
function getRelativeLuminance(rgb) {
    const channel = (value) => {
        const normalized = value / 255;
        if (normalized <= 0.03928) {
            return normalized / 12.92;
        }
        return ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const r = channel(rgb.r);
    const g = channel(rgb.g);
    const b = channel(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * @param {{ r: number, g: number, b: number }} from
 * @param {{ r: number, g: number, b: number }} to
 * @param {number} weight
 * @returns {{ r: number, g: number, b: number }}
 */
function mixRgb(from, to, weight) {
    return {
        r: from.r + (to.r - from.r) * weight,
        g: from.g + (to.g - from.g) * weight,
        b: from.b + (to.b - from.b) * weight
    };
}

/**
 * @param {string} colorValue
 * @param {string} fallback
 * @param {boolean} isDarkMode
 * @returns {string}
 */
function getReadableProfileThemeColor(colorValue, fallback, isDarkMode) {
    const normalized = normalizeProfileHex(colorValue);
    if (!normalized) {
        return fallback;
    }
    let rgb = hexToRgb(normalized);
    if (!rgb) {
        return fallback;
    }

    const luminanceThreshold = isDarkMode
        ? THEME_COLOR_LIMITS.darkMinLuminance
        : THEME_COLOR_LIMITS.lightMaxLuminance;
    let luminance = getRelativeLuminance(rgb);
    const requiresAdjustment = isDarkMode
        ? luminance < luminanceThreshold
        : luminance > luminanceThreshold;
    if (!requiresAdjustment) {
        return normalized;
    }

    // Nudge only extreme values so profile colors remain recognizable.
    const targetRgb = isDarkMode
        ? { r: 255, g: 255, b: 255 }
        : { r: 0, g: 0, b: 0 };
    for (let i = 0; i < 14; i++) {
        rgb = mixRgb(rgb, targetRgb, 0.18);
        luminance = getRelativeLuminance(rgb);
        if (
            (isDarkMode && luminance >= luminanceThreshold) ||
            (!isDarkMode && luminance <= luminanceThreshold)
        ) {
            break;
        }
    }
    return rgbToHex(rgb);
}

/**
 *
 * @param {object} user
 * @param {boolean} pendingOffline
 * @param {object} currentUser - current user object from useUserStore
 * @returns
 */
function userStatusClass(user, pendingOffline = false, currentUser) {
    const style = {
        'status-icon': true
    };
    if (typeof user === 'undefined') {
        return null;
    }
    let id = '';
    if (user.id) {
        id = user.id;
    } else if (user.userId) {
        id = user.userId;
    }
    if (id === currentUser?.id) {
        const platform = currentUser.presence?.platform;
        return {
            ...style,
            ...statusClass(user.status),
            mobile:
                platform &&
                platform !== 'standalonewindows' &&
                platform !== 'web'
        };
    }
    if (!user.isFriend) {
        return null;
    }
    if (pendingOffline) {
        // Pending offline
        style.offline = true;
    } else if (
        user.status !== 'active' &&
        user.location === 'private' &&
        user.state === '' &&
        id &&
        !(currentUser?.onlineFriends || []).includes(id)
    ) {
        // temp fix
        if ((currentUser?.activeFriends || []).includes(id)) {
            // Active
            if (user.status === 'join me') {
                style['active-joinme'] = true;
            } else if (user.status === 'ask me') {
                style['active-askme'] = true;
            } else if (user.status === 'busy') {
                style['active-busy'] = true;
            } else {
                style.active = true;
            }
        } else {
            // Offline
            style.offline = true;
        }
    } else if (user.state === 'active') {
        // Active
        if (user.status === 'join me') {
            style['active-joinme'] = true;
        } else if (user.status === 'ask me') {
            style['active-askme'] = true;
        } else if (user.status === 'busy') {
            style['active-busy'] = true;
        } else {
            style.active = true;
        }
    } else if (user.location === 'offline') {
        // Offline
        style.offline = true;
    } else if (user.status === 'active') {
        // Online
        style.online = true;
    } else if (user.status === 'join me') {
        // Join Me
        style.joinme = true;
    } else if (user.status === 'ask me') {
        // Ask Me
        style.askme = true;
    } else if (user.status === 'busy') {
        // Do Not Disturb
        style.busy = true;
    } else {
        // Unknown status
        return null;
    }
    if (
        user.$platform &&
        user.$platform !== 'standalonewindows' &&
        user.$platform !== 'web' &&
        user.state === 'online'
    ) {
        style.mobile = true;
    }
    return style;
}

/**
 *
 * @param {string} status
 * @returns {object}
 */
function statusClass(status) {
    if (typeof status === 'undefined') {
        return null;
    }
    const style = {
        'status-icon': true
    };
    if (status === 'active') {
        // Online
        style.online = true;
    } else if (status === 'join me') {
        // Join Me
        style.joinme = true;
    } else if (status === 'ask me') {
        // Ask Me
        style.askme = true;
    } else if (status === 'busy') {
        // Do Not Disturb
        style.busy = true;
    } else {
        return null;
    }
    return style;
}

/**
 * @param {object} user - User Ref Object
 * @param {boolean} isIcon - is use for icon (about 40x40)
 * @param {string} resolution - requested icon resolution (default 128),
 * @returns {string} - img url
 */
function userImage(user, isIcon = false, resolution = '128') {
    if (!user) {
        return '';
    }
    if (user.iconUrl) {
        if (isIcon) {
            return convertFileUrlToImageUrl(user.iconUrl);
        }
        return user.iconUrl;
    }

    if (user.profilePicOverrideThumbnail) {
        if (isIcon) {
            return user.profilePicOverrideThumbnail.replace(
                '/256',
                `/${resolution}`
            );
        }
        return user.profilePicOverrideThumbnail;
    }
    if (user.profilePicOverride) {
        return user.profilePicOverride;
    }
    if (user.thumbnailUrl) {
        return user.thumbnailUrl;
    }
    if (user.currentAvatarThumbnailImageUrl) {
        if (isIcon) {
            return user.currentAvatarThumbnailImageUrl.replace(
                '/256',
                `/${resolution}`
            );
        }
        return user.currentAvatarThumbnailImageUrl;
    }
    if (user.currentAvatarImageUrl) {
        if (isIcon) {
            return convertFileUrlToImageUrl(user.currentAvatarImageUrl);
        }
        return user.currentAvatarImageUrl;
    }
    return '';
}

/**
 *
 * @param {object} user
 * @returns {string|*}
 */
function userImageFull(user) {
    if (!user) {
        return '';
    }
    if (user.iconUrl) {
        return user.iconUrl;
    }
    if (user.profilePicOverride) {
        return user.profilePicOverride;
    }
    return user.currentAvatarImageUrl;
}

/**
 *
 * @param {string} user
 * @returns {*|string}
 */
function parseUserUrl(user) {
    const url = new URL(user);
    const urlPath = url.pathname;
    if (urlPath.substring(5, 11) === '/user/') {
        const userId = urlPath.substring(11);
        return userId;
    }
}

/**
 *
 * @param {object} ref
 * @returns {string}
 */
function userOnlineFor(ref) {
    if (ref.state === 'online' && ref.$online_for) {
        return timeToText(Date.now() - ref.$online_for);
    } else if (ref.state === 'active' && ref.$active_for) {
        return timeToText(Date.now() - ref.$active_for);
    } else if (ref.$offline_for) {
        return timeToText(Date.now() - ref.$offline_for);
    }
    return '-';
}

/**
 * Find a user object from cachedUsers by displayName.
 * @param {Map} cachedUsers
 * @param {string} displayName
 * @param {Map<string, Set<string>>} [cachedUserIdsByDisplayName]
 * @returns {object|undefined}
 */
function findUserByDisplayName(
    cachedUsers,
    displayName,
    cachedUserIdsByDisplayName
) {
    const indexedUserIds = cachedUserIdsByDisplayName?.get(displayName);
    if (indexedUserIds) {
        for (const userId of indexedUserIds) {
            const ref = cachedUsers.get(userId);
            if (ref?.displayName === displayName) {
                return ref;
            }
        }
    }
    for (const ref of cachedUsers.values()) {
        if (ref.displayName === displayName) {
            return ref;
        }
    }
    return undefined;
}

export {
    userOnlineForTimestamp,
    userOnlineFor,
    languageClass,
    getNameColour,
    getReadableProfileThemeColor,
    removeEmojis,
    userStatusClass,
    statusClass,
    userImage,
    userImageFull,
    parseUserUrl,
    findUserByDisplayName,
    resolveUserPresence,
    isPresenceOnline
};
