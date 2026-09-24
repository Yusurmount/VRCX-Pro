import { VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';

import {
    i18n,
    initComponents,
    initDayjs,
    initInteropApi,
    initRouter,
    initSentry,
    initUi,
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
let routeReady = false;
let resourcesReady = document.readyState === 'complete';
let backendReady = false;
let startMinimized = false;
let mainWindowShown = false;

// The initial routes are small and required by every first-run path. Start their
// chunks alongside backend/UI initialization instead of waiting until mount.
Promise.all([
    import('./views/Login/Login.vue'),
    import('./views/OOBE/OOBE.vue'),
    import('./views/Feed/Feed.vue')
]).catch(() => {});

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
    showMainWindow();
    // 等淡出过渡 (0.4s) 结束再销毁元素，释放持续运行的动画
    setTimeout(() => boot.remove(), 500);
}

function showMainWindow() {
    if (mainWindowShown || startMinimized) return;
    mainWindowShown = true;
    window.platform?.showMainWindow?.();
}

function tryHideBoot() {
    console.warn('[boot-state]', {
        routeReady,
        resourcesReady,
        backendReady,
        readyState: document.readyState
    });
    if (routeReady && resourcesReady && backendReady) {
        hideBoot();
    }
}

setTimeout(() => {
    // Show the window behind the boot layer if initialization is slow; never
    // reveal an unfinished app as a plain background.
    if (backendReady) showMainWindow();
}, 6000);

// 禁用默认右键/上下文菜单（WebView2/Chromium 中 preventDefault 会抑制原生菜单，
// 元素自己的 @contextmenu 处理仍可正常触发）
window.addEventListener('contextmenu', (event) => event.preventDefault());

await initInteropApi();

const uiReady = initUi().then(() => {
    initDayjs();
});
const piniaReady = initPiniaPlugins();

// Also check the "Start Minimized" user preference from config storage.
const startMinimizedPreference = startMinimized
    ? Promise.resolve()
    : VRCXStorage.Get('VRCX_StartAsMinimizedState')
          .then((minimizedSetting) => {
              if (minimizedSetting === 'true') {
                  startMinimized = true;
              }
          })
          .catch(() => {});

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

if (launchArgs?.reset_window) {
    try {
        await VRCXStorage.Set('VRCX_LocationX', '');
        await VRCXStorage.Set('VRCX_LocationY', '');
        await VRCXStorage.Set('VRCX_SizeWidth', '');
        await VRCXStorage.Set('VRCX_SizeHeight', '');
        await VRCXStorage.Set('VRCX_WindowState', 'normal');
    } catch (error) {
        console.error(error);
    }
}

await Promise.all([uiReady, piniaReady, startMinimizedPreference]);

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
        routeReady = true;
        tryHideBoot();
    });
// load 事件可能在上方的 await 期间已触发，不能依赖模块加载时捕获的旧值
if (document.readyState === 'complete') {
    resourcesReady = true;
    tryHideBoot();
} else {
    window.addEventListener(
        'load',
        () => {
            resourcesReady = true;
            tryHideBoot();
        },
        { once: true }
    );
}

// 后端就绪：等待数据库初始化完成后隐藏启动加载层
backendReadyPromise.then(() => {
    backendReady = true;
    tryHideBoot();
});
