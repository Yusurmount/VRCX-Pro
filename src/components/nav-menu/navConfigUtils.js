import dayjs from 'dayjs';

import { isToolNavKey } from '../../shared/constants';
import { collectLayoutKeys } from './navLayoutHelpers';

export const NAV_CONFIG_KEY = 'VRCX_customNavMenuLayoutList';

// 启动早期（App 挂载前的静默窗口内）预取侧边栏自定义配置，
// 使 loadStoredNavConfig 不必在登录后的数据洪峰里排队。
let prefetchedNavConfigPromise = null;

export function prefetchStoredNavConfig(
    repository,
    configKey = NAV_CONFIG_KEY
) {
    if (!prefetchedNavConfigPromise) {
        prefetchedNavConfigPromise = repository
            .getString(configKey)
            .catch(() => null);
    }
    return prefetchedNavConfigPromise;
}

function takePrefetchedNavConfig(configKey) {
    if (configKey !== NAV_CONFIG_KEY || !prefetchedNavConfigPromise) {
        return null;
    }
    const pending = prefetchedNavConfigPromise;
    prefetchedNavConfigPromise = null;
    return pending;
}

export function generateNavFolderId() {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        return `nav-folder-${crypto.randomUUID()}`;
    }

    return `nav-folder-${dayjs().toISOString()}-${Math.random().toString().slice(2, 4)}`;
}

export function createNavDefinitionMap(definitions = []) {
    const map = new Map();
    definitions.forEach((definition) => {
        if (definition?.key) {
            map.set(definition.key, definition);
        }
    });
    return map;
}

export function buildNavDefinitionsForLayout(
    baseDefinitions = [],
    dashboardDefinitions = [],
    layout = [],
    hiddenKeys = []
) {
    const keysInLayout = collectLayoutKeys(layout);
    const hiddenSet = new Set(Array.isArray(hiddenKeys) ? hiddenKeys : []);
    const visibleBaseDefinitions = baseDefinitions.filter(
        (definition) =>
            !isToolNavKey(definition.key) || keysInLayout.has(definition.key)
    );
    const visibleDashboardDefinitions = dashboardDefinitions.filter(
        (definition) =>
            keysInLayout.has(definition.key) || hiddenSet.has(definition.key)
    );

    return [...visibleBaseDefinitions, ...visibleDashboardDefinitions];
}

export async function loadStoredNavConfig(
    repository,
    fallbackLayout,
    { configKey = NAV_CONFIG_KEY, filterHiddenKey = () => true } = {}
) {
    let layout = fallbackLayout;
    let hiddenKeys = [];

    const pendingPrefetch = takePrefetchedNavConfig(configKey);
    const storedValue = pendingPrefetch
        ? await pendingPrefetch
        : await repository.getString(configKey);
    if (!storedValue) {
        return { layout, hiddenKeys };
    }

    try {
        const parsed = JSON.parse(storedValue);
        if (Array.isArray(parsed)) {
            layout = parsed;
        } else if (Array.isArray(parsed?.layout)) {
            layout = parsed.layout;
            hiddenKeys = Array.isArray(parsed.hiddenKeys)
                ? parsed.hiddenKeys.filter(filterHiddenKey)
                : [];
        }
    } catch {
        // keep defaults
    }

    return { layout, hiddenKeys };
}
