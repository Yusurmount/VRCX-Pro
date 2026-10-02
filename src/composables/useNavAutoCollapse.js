const NAV_AUTO_COLLAPSE_WIDTH = 960;

/**
 * 窗口逻辑宽度向下穿越 960 阈值时自动折叠左侧导航，向上穿越时恢复
 * 用户折叠偏好（仅当折叠是自动触发的）。只在穿越瞬间生效：阈值区间内
 * 用户手动展开/收起不会被反复强制。
 *
 * @param {object} store appearance store（需提供 autoCollapseNav / autoExpandNav）
 */
export function useNavAutoCollapse(store) {
    let lastWidth = null;

    const evaluateWidth = (width) => {
        if (!Number.isFinite(width)) return;
        const below = width < NAV_AUTO_COLLAPSE_WIDTH;
        const wasBelow =
            lastWidth !== null && lastWidth < NAV_AUTO_COLLAPSE_WIDTH;
        if (below && !wasBelow) {
            store.autoCollapseNav();
        } else if (!below && wasBelow) {
            store.autoExpandNav();
        }
        lastWidth = width;
    };

    window.platform
        ?.getWindowInnerSize?.()
        .then((size) => {
            if (size) evaluateWidth(size.width);
        })
        .catch(() => {});
    const stop =
        window.platform?.onWindowInnerResize?.((size) =>
            evaluateWidth(size?.width)
        ) ?? (() => {});

    return { evaluateWidth, stop };
}
