import { VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';

import {
    i18n,
    initComponents,
    initPlugins,
    initRouter,
    initSentry,
    router
} from './plugins';
import { initPiniaPlugins, pinia } from './stores';
import { queryClient } from './queries';

import App from './App.vue';
import { installRuntimeBridge } from './platform/runtime.js';
import { backendReadyPromise } from './platform/bootReady.js';

installRuntimeBridge();

// Boot screen: wait for BOTH backend ready AND frontend components loaded
const boot = document.getElementById('app-boot');
let bootHidden = false;
let frontendReady = false;
let backendReady = false;
let startMinimized = false;

// Resolve launch args early so hideBoot can check them.
// By the time hideBoot is called (after initPlugins/initPiniaPlugins), this should be resolved.
const launchArgs = await window.platform.launchArgsPromise;
if (launchArgs?.startup) {
    startMinimized = true;
}
// Store launch args on platform for other modules to access.
window.platform.launchArgs = launchArgs || {};

function hideBoot() {
    if (bootHidden || !boot) return;
    bootHidden = true;
    boot.classList.add('boot-hidden');
    // Only show the main window when not starting minimized (--startup flag or isStartAsMinimizedState)
    if (!startMinimized) {
        window.platform?.showMainWindow?.();
    }
    // 等淡出过渡 (0.4s) 结束再销毁元素，释放持续运行的动画
    setTimeout(() => boot.remove(), 500);
}

function tryHideBoot() {
    if (frontendReady && backendReady) {
        hideBoot();
    }
}

setTimeout(hideBoot, 6000); // 兜底：初始化挂起时也必须显示窗口

// 禁用默认右键/上下文菜单（WebView2/Chromium 中 preventDefault 会抑制原生菜单，
// 元素自己的 @contextmenu 处理仍可正常触发）
window.addEventListener('contextmenu', (event) => event.preventDefault());

await initPlugins();
await initPiniaPlugins();

// Also check the "Start Minimized" user preference from config storage.
if (!startMinimized) {
    try {
        const minimizedSetting = await VRCXStorage.Get(
            'VRCX_StartAsMinimizedState'
        );
        if (minimizedSetting === 'true') {
            startMinimized = true;
        }
    } catch {
        // ignore if storage not available
    }
}

// Apply --debug launch arg: enable debug logging.
if (launchArgs?.debug) {
    const { AppDebug } = await import('./services/appConfig.js');
    AppDebug.debug = true;
}

// Apply --proxy-server launch arg: override proxy setting in storage.
if (launchArgs?.proxy_server) {
    try {
        await VRCXStorage.Set('VRCX_ProxyServer', launchArgs.proxy_server);
    } catch {
        // ignore if storage not available
    }
}

// Apply --disable-gpu launch arg: override GPU acceleration setting in storage.
if (launchArgs?.disable_gpu) {
    try {
        await VRCXStorage.Set('VRCX_DisableGpuAcceleration', 'true');
    } catch {
        // ignore if storage not available
    }
}

// Apply --width and --height launch args: override saved window size in storage.
if (launchArgs?.width || launchArgs?.height) {
    try {
        if (launchArgs.width) {
            await VRCXStorage.Set('VRCX_SizeWidth', String(launchArgs.width));
        }
        if (launchArgs.height) {
            await VRCXStorage.Set('VRCX_SizeHeight', String(launchArgs.height));
        }
        // Also resize the Tauri window immediately.
        const w = launchArgs.width || 1280;
        const h = launchArgs.height || 800;
        window.platform?.resizeWindow?.(w, h);
    } catch {
        // ignore if storage not available
    }
}

// Apply --center launch arg: center the window on screen.
if (launchArgs?.center) {
    try {
        // Clear saved position so the window centers instead of restoring old position.
        await VRCXStorage.Set('VRCX_LocationX', '');
        await VRCXStorage.Set('VRCX_LocationY', '');
        window.platform?.centerWindow?.();
    } catch {
        // ignore if storage not available
    }
}

// #region | Hey look it's most of VRCX!

const app = createApp(App);

app.use(pinia).use(i18n).use(VueQueryPlugin, { queryClient });
initComponents(app);
initRouter(app);
await initSentry(app);

app.mount('#root');

// 前端就绪：路由就绪 + 页面资源加载完成
router
    .isReady()
    .catch(() => {})
    .then(() => {
        frontendReady = true;
        tryHideBoot();
    });
window.addEventListener('load', () => {
    frontendReady = true;
    tryHideBoot();
});

// 后端就绪：等待数据库初始化完成后隐藏启动加载层
backendReadyPromise.then(() => {
    backendReady = true;
    tryHideBoot();
});
