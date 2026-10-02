import {
    getCurrentInstance,
    onBeforeUnmount,
    onMounted,
    ref,
    watch
} from 'vue';

import {
    getMediaObjectUrl,
    isCacheableMediaUrl,
    loadMediaObjectUrl
} from '../services/mediaCache';

/** 解析期间的占位图：保持 <img> 盒子尺寸且不发网络请求 */
export const MEDIA_PLACEHOLDER_SRC =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * 将远程图片地址解析为会话内缓存的 objectURL。
 *
 * - 非远程地址（data:/blob:/本地）直接透传
 * - 会话缓存命中：同步返回 objectURL
 * - 未命中：经 sidecar 拉取并记忆；失败回退原始地址（浏览器原生加载兜底）
 * - lazy：缓存未命中时等待目标元素进入视口附近再拉取
 *
 * @param {import('vue').Ref<string>} sourceRef 图片地址
 * @param {{lazy?: boolean, findTarget?: () => Element | null}} [options]
 *   findTarget: lazy 观察目标的自定义取法；默认取自身元素（v-if 占位注释的父节点）
 * @returns {{displaySrc: import('vue').Ref<string>}} 解析期间为空字符串
 */
export function useMediaSrc(sourceRef, options = {}) {
    const { lazy = false, findTarget = null } = options;
    const displaySrc = ref('');

    let disposed = false;
    /** @type {IntersectionObserver | null} */
    let observer = null;

    function stopObserve() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    function currentUrl() {
        const url = sourceRef.value;
        return typeof url === 'string' ? url : '';
    }

    /**
     * 可同步确定的目标地址；返回 null 表示需要异步拉取。
     * @returns {string | null}
     */
    function syncTarget() {
        const url = currentUrl();
        if (!url) {
            return '';
        }
        if (!isCacheableMediaUrl(url)) {
            return url;
        }
        return getMediaObjectUrl(url) || null;
    }

    async function resolve() {
        const url = currentUrl();
        if (!url) {
            displaySrc.value = '';
            return;
        }
        if (!isCacheableMediaUrl(url)) {
            displaySrc.value = url;
            return;
        }
        const cached = getMediaObjectUrl(url);
        if (cached) {
            displaySrc.value = cached;
            return;
        }
        try {
            const objectUrl = await loadMediaObjectUrl(url);
            if (!disposed && currentUrl() === url) {
                displaySrc.value = objectUrl;
            }
        } catch {
            if (!disposed && currentUrl() === url) {
                // 缓存拉取失败，回退浏览器原生加载
                displaySrc.value = url;
            }
        }
    }

    function ownElement() {
        const instance = getCurrentInstance();
        const el = instance?.vnode?.el;
        if (!el) {
            return null;
        }
        // v-if 未渲染时 vnode.el 为注释节点，其 parent 即容器
        return el.nodeType === 8 ? el.parentNode : el;
    }

    function startLazyGate() {
        const target =
            typeof findTarget === 'function' ? findTarget() : ownElement();
        if (!target || typeof IntersectionObserver === 'undefined') {
            resolve();
            return;
        }
        observer = new IntersectionObserver(
            (entriesList) => {
                if (entriesList.some((entry) => entry.isIntersecting)) {
                    stopObserve();
                    resolve();
                }
            },
            { rootMargin: '200px' }
        );
        observer.observe(target);
    }

    // 初次：能同步确定就立即出图；否则按 lazy 决定直接拉取或等视口
    const initial = syncTarget();
    if (initial !== null) {
        displaySrc.value = initial;
    } else if (!lazy) {
        resolve();
    } else {
        // 挂载后取观察目标（组件上下文外调用时退化为直接解析）
        if (getCurrentInstance()) {
            onMounted(() => {
                if (!disposed) {
                    startLazyGate();
                }
            });
        } else {
            resolve();
        }
    }

    // 地址变化：立即重新解析（不再等视口）
    watch(sourceRef, () => {
        stopObserve();
        const target = syncTarget();
        if (target !== null) {
            displaySrc.value = target;
        } else {
            resolve();
        }
    });

    if (getCurrentInstance()) {
        onBeforeUnmount(() => {
            disposed = true;
            stopObserve();
        });
    }

    return { displaySrc };
}
