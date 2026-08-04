<template>
    <div v-if="visible" aria-hidden="true" class="am-background">
        <canvas ref="canvasRef" class="am-canvas"></canvas>
    </div>
</template>

<script setup>
    import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
    import { storeToRefs } from 'pinia';

    import { useAppearanceSettingsStore } from '@/stores';

    const appearanceSettingsStore = useAppearanceSettingsStore();
    const { useAdvancedMaterial: visible } = storeToRefs(appearanceSettingsStore);

    const canvasRef = ref(null);

    let themeObserver = null;
    let resizeObserver = null;
    let xcObserver = null;

    // 鼠标高光：白色圆形模糊渲染在"当前实体"的背景层（background-image
    // 位于 background-color 之上、内容之下），实体自身盖住高光，光晕介于
    // 控件与背景之间。命中实体写入相对坐标并置 --am-a 1（平滑淡入），
    // 切换/离开时旧实体置 --am-a 0 平滑淡出后移除类，空白区无光。
    // 仅命中交互控件，不命中卡片/内容区等文本容器（避免高光融在文本容器内）。
    const entitySelector = [
        '[data-slot]',
        "[role='tab']",
        "[role='tablist']",
        "[role='menuitem']",
        "[role='button']",
        "[role='checkbox']",
        "[role='switch']",
        'button',
        'a',
        'input',
        'textarea',
        'select'
    ].join(', ');
    // 非交互容器/文本/数据型 data-slot：不作为高光目标（表格单元格、对话框标题/底部、
    // 卡片标题/描述、标签、分隔线、装饰等）。命中后向上继续查找最近的可高光实体，
    // 避免高光零散地挂在文本与结构容器上造成视觉割裂。
    const NON_GLOW_SLOTS = new Set([
        // 表格：纯数据区不挂高光，高光只落在单元格内的控件上
        'table-container',
        'table',
        'table-header',
        'table-body',
        'table-footer',
        'table-row',
        'table-head',
        'table-cell',
        'table-caption',
        // 对话框/弹层结构容器（面板 content 除外）
        'dialog',
        'dialog-overlay',
        'dialog-header',
        'dialog-footer',
        'dialog-title',
        'dialog-description',
        'alert-dialog',
        'alert-dialog-overlay',
        'alert-dialog-header',
        'alert-dialog-footer',
        'alert-dialog-title',
        'alert-dialog-description',
        'sheet',
        'sheet-overlay',
        'sheet-header',
        'sheet-footer',
        'sheet-title',
        'sheet-description',
        // 卡片结构容器
        'card',
        'card-header',
        'card-footer',
        'card-title',
        'card-description',
        // 表单/标签/文本
        'label',
        'field-label',
        'field-title',
        'field-description',
        'field-error',
        'field-legend',
        'field-set',
        'field-group',
        'form-label',
        'form-description',
        'form-message',
        'form-item',
        'form-control',
        'select-label',
        'select-group',
        'select-item-text',
        'native-select-option',
        'native-select-optgroup',
        'native-select-wrapper',
        // 触发/包装型元素：仅绑定交互事件,视觉上是文本/图标,不作为高光目标
        // （若 as-child 包裹 button 等可见控件,鼠标落在控件上时仍走控件高光）
        'tooltip-trigger',
        'context-menu-trigger',
        'dropdown-menu-trigger',
        'popover-trigger',
        'hover-card-trigger',
        'dialog-trigger',
        'alert-dialog-trigger',
        'sheet-trigger',
        'collapsible-trigger',
        // 菜单分组/装饰
        'dropdown-menu',
        'dropdown-menu-label',
        'dropdown-menu-group',
        'dropdown-menu-shortcut',
        'dropdown-menu-separator',
        'dropdown-menu-radio-group',
        'dropdown-menu-sub',
        'dropdown-menu-sub-content',
        'context-menu',
        'context-menu-label',
        'context-menu-group',
        'context-menu-shortcut',
        'context-menu-separator',
        'context-menu-portal',
        'context-menu-sub',
        'context-menu-sub-content',
        // 通用装饰
        'separator',
        'badge',
        'progress',
        'progress-indicator',
        'skeleton',
        'avatar',
        'avatar-image',
        'avatar-fallback',
        // 命令面板结构（面板与可交互项保留）
        'command-list',
        'command-group',
        'command-group-heading',
        'command-empty',
        'command-shortcut',
        'command-input-wrapper',
        'command-separator',
        // 提示层（纯文本提示不挂高光）
        'tooltip',
        'tooltip-content',
        'tooltip-arrow',
        // 面包屑/分页
        'breadcrumb',
        'breadcrumb-list',
        'breadcrumb-item',
        'breadcrumb-page',
        'breadcrumb-separator',
        'breadcrumb-ellipsis',
        'pagination-list',
        'pagination-ellipsis',
        // 空状态
        'empty',
        'empty-header',
        'empty-title',
        'empty-description',
        'empty-content',
        'empty-icon',
        // 提示条
        'alert',
        'alert-title',
        'alert-description',
        // 日历结构
        'calendar',
        'calendar-grid',
        'calendar-header',
        'calendar-head-cell',
        'calendar-heading',
        'calendar-grid-row',
        'calendar-grid-body',
        'calendar-cell',
        // 折叠
        'collapsible',
        'collapsible-content',
        // 侧栏结构容器（sidebar 面板与可交互按钮保留）
        'sidebar-content',
        'sidebar-group',
        'sidebar-group-content',
        'sidebar-group-label',
        'sidebar-footer',
        'sidebar-header',
        'sidebar-inset',
        'sidebar-menu',
        'sidebar-menu-item',
        'sidebar-menu-sub',
        'sidebar-menu-sub-item',
        'sidebar-menu-badge',
        'sidebar-menu-skeleton',
        'sidebar-rail',
        'sidebar-separator',
        'sidebar-wrapper',
        // 滚动/可调整
        'scroll-area',
        'scroll-area-viewport',
        'scroll-area-scrollbar',
        'resizable-panel',
        'resizable-panel-group',
        // 轮播结构
        'carousel',
        'carousel-content',
        'carousel-item',
        // 输入装饰
        'input-group-addon',
        'input-otp-slot',
        'input-otp-separator',
        // 浮层根/锚点（面板 content 保留）
        'popover',
        'popover-anchor',
        // 工具栏分组
        'toggle-group'
    ]);

    // 从命中的元素向上跳过黑名单容器，返回最近的可高光实体（面板/交互控件）
    function findGlowTarget(el) {
        while (el) {
            const slot = el.dataset?.slot;
            if (slot && NON_GLOW_SLOTS.has(slot)) {
                el = el.parentElement;
                continue;
            }
            if (el.matches(entitySelector)) return el;
            el = el.parentElement;
        }
        return null;
    }

    let glowRaf = 0;
    let glowEl = null;
    let lastGlowEl = null;
    let glowX = 0;
    let glowY = 0;
    let glowFadeTimer = 0;

    function onGlowMove(e) {
        glowX = e.clientX;
        glowY = e.clientY;
        const t = e.target;
        glowEl = null;
        if (t?.closest) {
            // 头像 / 图片 / 文本框：不显示高光
            if (
                !t.closest(
                    "img, [data-slot='avatar'], [data-slot='avatar-image'], [data-slot='avatar-fallback'], .avatar, input, textarea"
                )
            ) {
                // 纯文本（不在交互控件内）不显示高光；控件内部文字仍触发控件高光
                const textEl = t.closest('p, span, td, th, label, h1, h2, h3, h4, h5, h6, li, em, strong, small');
                if (!textEl || textEl.closest('button, a, [role], [data-slot]')) {
                    glowEl = findGlowTarget(t.closest(entitySelector));
                }
            }
        }
        if (glowRaf) return;
        glowRaf = requestAnimationFrame(() => {
            glowRaf = 0;
            if (lastGlowEl && lastGlowEl !== glowEl) {
                // 旧实体淡出，过渡完成后移除类
                lastGlowEl.style.setProperty('--am-a', '0');
                clearTimeout(glowFadeTimer);
                glowFadeTimer = setTimeout(() => {
                    if (lastGlowEl && lastGlowEl.style.getPropertyValue('--am-a') === '0') {
                        lastGlowEl.classList.remove('am-glow-on');
                    }
                }, 220);
            }
            lastGlowEl = glowEl;
            if (!glowEl) return;
            const rect = glowEl.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            glowEl.style.setProperty('--am-mx', (((glowX - rect.left) / rect.width) * 100).toFixed(2) + '%');
            glowEl.style.setProperty('--am-my', (((glowY - rect.top) / rect.height) * 100).toFixed(2) + '%');
            glowEl.classList.add('am-glow-on');
            glowEl.style.setProperty('--am-a', '1');
        });
    }

    // oklch → sRGB（canvas gradient 的 addColorStop / fillStyle 仅接受 sRGB 颜色，
    // 不支持 CSS Color 4 的 oklch）。支持 L 百分比或小数、C 百分比(相对 0.4)或小数、H 角度。
    function oklchToRgb(str) {
        const match = str.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:\s*\/\s*[^)]+)?\s*\)/);
        if (!match) return { r: 16, g: 179, b: 232 };
        const L = match[1].endsWith('%') ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
        let C = parseFloat(match[2]);
        if (match[2].endsWith('%')) C = (C / 100) * 0.4;
        const H = parseFloat(match[3]);

        // oklch → oklab
        const a = C * Math.cos((H * Math.PI) / 180);
        const b = C * Math.sin((H * Math.PI) / 180);
        // oklab → linear sRGB
        const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = L - 0.0894841775 * a - 1.291485548 * b;
        const l = l_ ** 3;
        const m = m_ ** 3;
        const s = s_ ** 3;
        let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
        let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
        let bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
        // linear sRGB → gamma sRGB
        const lin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
        r = lin(r);
        g = lin(g);
        bl = lin(bl);
        const clamp = (c) => Math.round(Math.min(255, Math.max(0, c * 255)));
        return { r: clamp(r), g: clamp(g), b: clamp(bl) };
    }

    // 将主题颜色解析为 canvas 可用的 sRGB 颜色字符串。
    // oklch 手动转换为 sRGB；其余格式交给浏览器计算为 sRGB。
    function parseColor(value) {
        const v = (value || '').trim();
        if (!v) return 'rgb(16, 179, 232)';
        if (v.startsWith('oklch')) {
            const { r, g, b } = oklchToRgb(v);
            return `rgb(${r}, ${g}, ${b})`;
        }
        const probe = document.createElement('div');
        probe.style.color = v;
        probe.style.display = 'none';
        document.body.appendChild(probe);
        const computed = getComputedStyle(probe).color;
        document.body.removeChild(probe);
        return computed;
    }

    // 为 sRGB 颜色字符串追加 alpha，转为 rgba()
    function withAlpha(color, alpha) {
        const rgb = color.match(/rgba?\(([^)]+)\)/);
        if (rgb) {
            const parts = rgb[1].split(',').map((part) => part.trim());
            return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha.toFixed(3)})`;
        }
        return color;
    }

    // 圆形光源的高斯模糊静态结果 = 径向高斯分布。
    // 用 createRadialGradient 按高斯曲线精确采样渲染，规避 ctx.filter
    // 在 Electron 环境不稳定的问题；模糊只计算一次，画布即为静态位图。
    function drawOrb(ctx, cx, cy, radius, color, alpha) {
        const sigma = radius / 3; // 高斯标准差：半径处强度衰减至约 1%
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        const stops = 12;
        for (let i = 0; i <= stops; i++) {
            const t = i / stops;
            const intensity = Math.exp(-((t * radius) ** 2) / (2 * sigma * sigma));
            grad.addColorStop(t, withAlpha(color, intensity));
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // 底部光影：离屏 canvas 一次性真实模糊，drawImage 固化为静态位图，
    // 之后无任何实时滤镜。ctx.filter 能力探测失败时回退为渐变模拟（drawOrb）。
    function render() {
        const canvas = canvasRef.value;
        if (!canvas) return;
        // 光斑为低细节模糊背景，限制 dpr 为 1 避免超大位图占用内存/显存
        const dpr = 1;
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const styles = getComputedStyle(document.documentElement);
        const primary = parseColor(styles.getPropertyValue('--primary'));
        const accent = parseColor(styles.getPropertyValue('--accent'));
        const ring = parseColor(styles.getPropertyValue('--ring'));
        const background = parseColor(styles.getPropertyValue('--background') || 'rgb(12, 14, 18)');

        const maxDim = Math.max(w, h);
        const isLight = document.documentElement.dataset.theme === 'light';
        // 色块组（混合层次：圆形光斑 + 圆角矩形色块，深浅叠加，光影晕染）
        const blobs = [
            {
                shape: 'circle',
                x: w * 0.12,
                y: h * 1.06,
                r: maxDim * 0.34,
                color: primary,
                alpha: 0.85,
                blur: maxDim * 0.1
            },
            {
                shape: 'circle',
                x: w * 0.9,
                y: h * 1.05,
                r: maxDim * 0.26,
                color: accent,
                alpha: 0.75,
                blur: maxDim * 0.09
            },
            {
                shape: 'rect',
                x: w * 0.28,
                y: h * 0.82,
                bw: maxDim * 0.28,
                bh: maxDim * 0.16,
                color: ring,
                alpha: 0.6,
                blur: maxDim * 0.06
            },
            {
                shape: 'circle',
                x: w * 0.55,
                y: h * 0.9,
                r: maxDim * 0.12,
                color: primary,
                alpha: 0.5,
                blur: maxDim * 0.07
            }
        ];

        // 离屏 canvas：纯色背景 + 色块 + 一次性真实模糊
        const off = document.createElement('canvas');
        off.width = canvas.width;
        off.height = canvas.height;
        const octx = off.getContext('2d');
        if (!octx) {
            fallbackDraw(ctx, w, h, maxDim, primary, accent, ring);
            return;
        }
        octx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // ctx.filter 能力探测：blur 后红点边缘应有扩散像素
        let filterOk = false;
        try {
            octx.filter = 'blur(8px)';
            octx.fillStyle = 'rgb(255, 0, 0)';
            octx.fillRect(0, 0, 3, 3);
            octx.filter = 'none';
            const probe = octx.getImageData(8, 2, 1, 1).data;
            filterOk = probe[3] > 0;
            octx.clearRect(0, 0, w, h);
        } catch {
            filterOk = false;
        }
        if (!filterOk) {
            fallbackDraw(ctx, w, h, maxDim, primary, accent, ring);
            return;
        }

        // 纯色背景（跟随主题明暗，半透明让下层略微透出）
        octx.globalAlpha = isLight ? 0.65 : 0.6;
        octx.fillStyle = background;
        octx.fillRect(0, 0, w, h);
        octx.globalAlpha = 1;

        // 各色块独立 blur 半径，一次性绘制（模糊只发生这一次）
        for (const b of blobs) {
            octx.save();
            octx.filter = `blur(${Math.round(b.blur)}px)`;
            octx.globalAlpha = b.alpha;
            octx.fillStyle = b.color;
            if (b.shape === 'circle') {
                octx.beginPath();
                octx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                octx.fill();
            } else {
                const r = Math.min(b.bw, b.bh) / 4;
                octx.beginPath();
                octx.moveTo(b.x + r, b.y);
                octx.arcTo(b.x + b.bw, b.y, b.x + b.bw, b.y + b.bh, r);
                octx.arcTo(b.x + b.bw, b.y + b.bh, b.x, b.y + b.bh, r);
                octx.arcTo(b.x, b.y + b.bh, b.x, b.y, r);
                octx.arcTo(b.x, b.y, b.x + b.bw, b.y, r);
                octx.closePath();
                octx.fill();
            }
            octx.restore();
        }
        octx.filter = 'none';

        // 固化：离屏结果一次性绘制到主 canvas（静态位图）
        ctx.drawImage(off, 0, 0, w, h);
    }

    // ctx.filter 不可用时的回退路径：径向渐变按高斯曲线采样模拟模糊静态结果
    function fallbackDraw(ctx, w, h, maxDim, primary, accent, ring) {
        drawOrb(ctx, w * 0.12, h * 1.06, maxDim * 0.34, primary, 0.48);
        drawOrb(ctx, w * 0.9, h * 1.05, maxDim * 0.26, accent, 0.4);
        drawOrb(ctx, w * 0.32, h * 0.92, maxDim * 0.14, ring, 0.26);
    }

    // 中间内容区（.x-container）与右侧好友栏（.x-aside-container）兜底：
    // CSS 规则可能被 globals.css 的同特异性后声明规则覆盖，内联样式
    // 优先级最高，直接置为透明由下层 sidebar-inset 单层半透明透出光影。
    const patchedXc = [];

    function applyXcTransparent() {
        document.querySelectorAll('.x-container, .x-aside-container').forEach((el) => {
            if (patchedXc.some((p) => p.el === el)) return;
            const hadInline = el.style.getPropertyValue('background-color') !== '';
            const prev = hadInline ? el.style.getPropertyValue('background-color') : '';
            el.style.setProperty('background-color', 'transparent', 'important');
            patchedXc.push({ el, hadInline, prev });
        });
    }

    function restoreXc() {
        for (const p of patchedXc) {
            if (p.hadInline) p.el.style.setProperty('background-color', p.prev);
            else p.el.style.removeProperty('background-color');
        }
        patchedXc.length = 0;
    }

    onMounted(() => {
        render();
        // 明暗模式 / 配色方案变化时重绘，使静态位图匹配当前主题
        themeObserver = new MutationObserver(render);
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme', 'data-theme-color']
        });
        resizeObserver = new ResizeObserver(() => {
            render();
        });
        resizeObserver.observe(document.documentElement);

        // 中间内容区透明兜底：初始扫描 + 路由切换新增 .x-container 时跟进
        applyXcTransparent();
        xcObserver = new MutationObserver(() => applyXcTransparent());
        xcObserver.observe(document.body, { childList: true, subtree: true });

        // 操作区鼠标泛影：跟随鼠标更新光晕位置
        window.addEventListener('mousemove', onGlowMove, { passive: true });
    });

    // 开关开启时 canvas 经 v-if 重建，onMounted 不会再次触发，
    // 需在 DOM 挂载后主动重绘
    watch(visible, (on) => {
        if (on) {
            nextTick(render);
        }
    });

    onBeforeUnmount(() => {
        themeObserver?.disconnect();
        resizeObserver?.disconnect();
        xcObserver?.disconnect();
        window.removeEventListener('mousemove', onGlowMove);
        cancelAnimationFrame(glowRaf);
        clearTimeout(glowFadeTimer);
        restoreXc();
    });
</script>

<style scoped>
    .am-background {
        position: fixed;
        inset: 0;
        z-index: 0;
        overflow: hidden;
        pointer-events: none;
    }

    .am-canvas {
        display: block;
        width: 100%;
        height: 100%;
    }

    /* 浅色主题下调低环境光强度，避免过曝 */
    :root[data-theme='light'] .am-canvas {
        opacity: 0.75;
    }
</style>
