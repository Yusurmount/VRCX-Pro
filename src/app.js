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

installRuntimeBridge();

// 禁用默认右键/上下文菜单（WebView2/Chromium 下 preventDefault 会抑制原生菜单，
// 元素自己的 @contextmenu 处理仍可正常触发）
window.addEventListener('contextmenu', (event) => event.preventDefault());

await initPlugins();
await initPiniaPlugins();

// #region | Hey look it's most of VRCX!

const app = createApp(App);

app.use(pinia).use(i18n).use(VueQueryPlugin, { queryClient });
initComponents(app);
initRouter(app);
await initSentry(app);

app.mount('#root');

// 组件加载/渲染完成后销毁启动加载层。不依赖 router.isReady() 单独等待：
// 它可能被导航守卫永远阻塞。用 isReady + window.load + 定时兜底多路触发，
// 保证无论哪种情况都必然在 UI 就绪后销毁。
const boot = document.getElementById('app-boot');
let bootHidden = false;
function hideBoot() {
    if (bootHidden || !boot) return;
    bootHidden = true;
    boot.classList.add('boot-hidden');
    // UI 就绪后才能显示主窗口（初始在 tauri.conf 中设为不可见，避免加载闪现）
    window.platform?.showMainWindow?.();
    // 等淡出过渡(0.4s)结束再销毁元素，释放持续运行的动画
    setTimeout(() => boot.remove(), 500);
}
router
    .isReady()
    .catch(() => {})
    .then(hideBoot);
window.addEventListener('load', hideBoot);
setTimeout(hideBoot, 6000); // 兜底：无论前两者状态如何，最终销毁
