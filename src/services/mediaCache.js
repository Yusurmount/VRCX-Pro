import webApiService from './webapi.js';

/**
 * 会话内图像/媒体缓存：远程图片统一经 sidecar 拉取为 blob，
 * 转成 objectURL 后按 URL 记忆复用，避免同一图片在会话内重复下载。
 * 缓存仅存于内存，应用退出即清空。
 */

const CACHE_MAX_ENTRIES = 600;
const CACHE_MAX_BYTES = 64 * 1024 * 1024;

/** @type {Map<string, {objectUrl: string, bytes: number}>} 插入序 = 最近使用序（命中会重新插入） */
const entries = new Map();
/** @type {Map<string, Promise<string>>} 同 URL 并发去重 */
const inflight = new Map();

let totalBytes = 0;

/**
 * 是否为可缓存的远程图片地址（http/https）。
 * data:、blob:、本地资源与空值直接透传。
 * @param {string} url
 * @returns {boolean}
 */
export function isCacheableMediaUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url);
}

/**
 * 同步读取已缓存的 objectURL。
 * @param {string} url
 * @returns {string} 未命中返回 ''
 */
export function getMediaObjectUrl(url) {
    const entry = entries.get(url);
    if (!entry) {
        return '';
    }
    // 触达即移到队尾，作为 LRU 序
    entries.delete(url);
    entries.set(url, entry);
    return entry.objectUrl;
}

function evictIfNeeded(keepUrl) {
    while (entries.size > CACHE_MAX_ENTRIES || totalBytes > CACHE_MAX_BYTES) {
        let oldestKey = null;
        for (const key of entries.keys()) {
            if (key !== keepUrl) {
                oldestKey = key;
                break;
            }
        }
        if (oldestKey === null) {
            break;
        }
        const entry = entries.get(oldestKey);
        URL.revokeObjectURL(entry.objectUrl);
        totalBytes -= entry.bytes;
        entries.delete(oldestKey);
    }
}

/**
 * 依据魔数纠正 blob 类型（sidecar 对所有图片统一返回 data:image/png 前缀）。
 * @param {Blob} blob
 * @returns {Promise<Blob>}
 */
async function withSniffedType(blob) {
    try {
        const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
        let type = '';
        if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
            type = 'image/jpeg';
        } else if (
            head[0] === 0x89 &&
            head[1] === 0x50 &&
            head[2] === 0x4e &&
            head[3] === 0x47
        ) {
            type = 'image/png';
        } else if (
            head[0] === 0x47 &&
            head[1] === 0x49 &&
            head[2] === 0x46 &&
            head[3] === 0x38
        ) {
            type = 'image/gif';
        } else if (
            head[0] === 0x52 &&
            head[1] === 0x49 &&
            head[2] === 0x46 &&
            head[3] === 0x46 &&
            head[8] === 0x57 &&
            head[9] === 0x45 &&
            head[10] === 0x42 &&
            head[11] === 0x50
        ) {
            type = 'image/webp';
        }
        if (type && type !== blob.type) {
            return new Blob([blob], { type });
        }
        return blob;
    } catch {
        return blob;
    }
}

/**
 * 经 sidecar 拉取远程图片并转为 Blob。
 * @param {string} url
 * @returns {Promise<Blob>}
 */
async function fetchRemoteBlob(url) {
    const response = await webApiService.execute({ url, method: 'GET' });
    if (
        response.status !== 200 ||
        typeof response.data !== 'string' ||
        !response.data.startsWith('data:')
    ) {
        throw new Error(`media fetch failed (${response.status})`);
    }
    const blob = await (await globalThis.fetch(response.data)).blob();
    return withSniffedType(blob);
}

/**
 * 拉取并缓存一张远程图片，返回 objectURL。
 * 并发同 URL 共享同一次请求；失败时抛错（调用方回退到原始地址）。
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function loadMediaObjectUrl(url) {
    if (!isCacheableMediaUrl(url)) {
        return url;
    }
    const cached = getMediaObjectUrl(url);
    if (cached) {
        return cached;
    }
    const pending = inflight.get(url);
    if (pending) {
        return pending;
    }
    const promise = (async () => {
        const blob = await fetchRemoteBlob(url);
        const objectUrl = URL.createObjectURL(blob);
        entries.set(url, { objectUrl, bytes: blob.size });
        totalBytes += blob.size;
        evictIfNeeded(url);
        return objectUrl;
    })();
    inflight.set(url, promise);
    try {
        return await promise;
    } finally {
        inflight.delete(url);
    }
}

/**
 * 清空整个媒体缓存（撤销全部 objectURL）。
 */
export function clearMediaCache() {
    for (const entry of entries.values()) {
        URL.revokeObjectURL(entry.objectUrl);
    }
    entries.clear();
    inflight.clear();
    totalBytes = 0;
}

export const _mediaCacheInternals = {
    entries,
    inflight,
    get totalBytes() {
        return totalBytes;
    },
    CACHE_MAX_ENTRIES,
    CACHE_MAX_BYTES
};
