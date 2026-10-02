import { flushPromises } from '@vue/test-utils';

import { useNavAutoCollapse } from '../useNavAutoCollapse';

describe('useNavAutoCollapse', () => {
    /** @type {((size: { width: number, height: number }) => void) | null} */
    let resizeHandler;
    let stopFn;

    /**
     * 状态化 fake store：guard 语义与 appearance store 的
     * autoCollapseNav / autoExpandNav 契约一致。
     */
    function makeStore(initialCollapsed = false) {
        const store = {
            collapsed: initialCollapsed,
            autoCollapsed: false,
            autoCollapseNav: vi.fn(() => {
                if (store.collapsed) return;
                store.collapsed = true;
                store.autoCollapsed = true;
            }),
            autoExpandNav: vi.fn(() => {
                if (!store.autoCollapsed) return;
                store.collapsed = false;
                store.autoCollapsed = false;
            })
        };
        return store;
    }

    function setupPlatform(initialWidth = 1280) {
        resizeHandler = null;
        stopFn = vi.fn();
        window.platform = {
            getWindowInnerSize: vi.fn(() =>
                Promise.resolve({ width: initialWidth, height: 800 })
            ),
            onWindowInnerResize: vi.fn((handler) => {
                resizeHandler = handler;
                return stopFn;
            })
        };
    }

    async function create(store, initialWidth = 1280) {
        setupPlatform(initialWidth);
        const composable = useNavAutoCollapse(store);
        await flushPromises();
        return composable;
    }

    test('does nothing when the window starts above the threshold', async () => {
        const store = makeStore(false);
        await create(store, 1280);
        expect(store.autoCollapseNav).not.toHaveBeenCalled();
        expect(store.collapsed).toBe(false);
    });

    test('auto-collapses when the window starts below 960', async () => {
        const store = makeStore(false);
        await create(store, 900);
        expect(store.autoCollapseNav).toHaveBeenCalledTimes(1);
        expect(store.collapsed).toBe(true);
        expect(store.autoCollapsed).toBe(true);
    });

    test('down-crossing 960 triggers auto-collapse', async () => {
        const store = makeStore(false);
        const { evaluateWidth } = await create(store, 1280);
        evaluateWidth(959);
        expect(store.autoCollapseNav).toHaveBeenCalledTimes(1);
        expect(store.collapsed).toBe(true);
    });

    test('does not re-trigger while staying below the threshold', async () => {
        const store = makeStore(false);
        const { evaluateWidth } = await create(store, 1280);
        evaluateWidth(959);
        evaluateWidth(900);
        evaluateWidth(820);
        expect(store.autoCollapseNav).toHaveBeenCalledTimes(1);
    });

    test('up-crossing 960 restores an auto-collapsed nav', async () => {
        const store = makeStore(false);
        const { evaluateWidth } = await create(store, 900);
        expect(store.collapsed).toBe(true);
        evaluateWidth(960);
        expect(store.autoExpandNav).toHaveBeenCalledTimes(1);
        expect(store.collapsed).toBe(false);
        expect(store.autoCollapsed).toBe(false);
    });

    test('keeps a preference that was already collapsed before crossing', async () => {
        const store = makeStore(true);
        const { evaluateWidth } = await create(store, 900);
        expect(store.collapsed).toBe(true);
        expect(store.autoCollapsed).toBe(false);

        evaluateWidth(1280);
        // 未接管过就不恢复展开
        expect(store.collapsed).toBe(true);
        expect(store.autoCollapsed).toBe(false);
    });

    test('a fresh down-crossing re-arms after the user took over', async () => {
        const store = makeStore(false);
        const { evaluateWidth } = await create(store, 1280);
        evaluateWidth(900);
        expect(store.collapsed).toBe(true);

        // 用户手动展开（setNavCollapsed(false) 会清掉接管标记）
        store.collapsed = false;
        store.autoCollapsed = false;

        // 区间内 resize 不会重新折叠
        resizeHandler({ width: 850, height: 600 });
        expect(store.autoCollapseNav).toHaveBeenCalledTimes(1);

        // 离开并再次向下穿越后重新自动折叠
        evaluateWidth(1280);
        evaluateWidth(900);
        expect(store.autoCollapseNav).toHaveBeenCalledTimes(2);
        expect(store.collapsed).toBe(true);
    });

    test('stop() unsubscribes the platform resize listener', async () => {
        const store = makeStore(false);
        const { stop } = await create(store);
        stop();
        expect(stopFn).toHaveBeenCalledTimes(1);
    });

    test('ignores non-finite widths', async () => {
        const store = makeStore(false);
        const { evaluateWidth } = await create(store, 1280);
        evaluateWidth(Number.NaN);
        evaluateWidth(undefined);
        expect(store.autoCollapseNav).not.toHaveBeenCalled();
        expect(store.autoExpandNav).not.toHaveBeenCalled();
    });
});
