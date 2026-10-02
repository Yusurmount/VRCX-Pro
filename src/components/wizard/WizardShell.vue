<template>
    <div ref="rootRef" class="wizard-shell bg-background">
        <!-- Top bar: step counter + segmented progress -->
        <header class="wiz-header">
            <span class="wiz-step-counter text-muted-foreground">
                {{ t('common.wizard.step_of', { current: currentStep, total: totalSteps }) }}
            </span>
        </header>
        <div
            class="wiz-progress"
            role="progressbar"
            :aria-valuenow="currentStep"
            aria-valuemin="1"
            :aria-valuemax="totalSteps">
            <div v-for="s in totalSteps" :key="s" class="wiz-progress-segment" :class="{ active: s <= currentStep }" />
        </div>

        <!-- Left: centered icon with SVG stroke animation -->
        <aside class="wiz-left">
            <Transition @enter="onIconEnter" @leave="onIconLeave" :css="false" mode="out-in">
                <div ref="iconWrapRef" :key="currentStep" class="wiz-icon-wrap">
                    <slot name="icon" :step="currentStep">
                        <component :is="icons[currentStep]" class="wiz-icon-svg" :stroke-width="1.5" />
                    </slot>
                </div>
            </Transition>
        </aside>

        <!-- Right: content -->
        <section class="wiz-right">
            <Transition @enter="onContentEnter" @leave="onContentLeave" :css="false" mode="out-in">
                <div ref="contentRef" :key="currentStep" class="wiz-content">
                    <slot />
                </div>
            </Transition>
        </section>

        <!-- Content that must survive step changes (dialogs, toasts, ...) -->
        <slot name="overlay" />
    </div>
</template>

<script setup>
    import { onUnmounted, ref } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { gsap } from 'gsap';
    import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

    gsap.registerPlugin(DrawSVGPlugin);

    defineProps({
        /** Current 1-based step */
        currentStep: { type: Number, required: true },
        totalSteps: { type: Number, required: true },
        /** Step -> icon component map (use markRaw on components) */
        icons: { type: Object, default: () => ({}) }
    });

    const { t } = useI18n();

    const rootRef = ref(null);
    const iconWrapRef = ref(null);
    const contentRef = ref(null);

    /**
     * Animate SVG icon stroke drawing
     * @param {Element} el
     */
    function animateIconDraw(el) {
        const svg = el?.querySelector('svg');
        if (!svg) return;
        const shapes = svg.querySelectorAll('path, circle, line, polyline, rect');
        if (!shapes.length) return;
        gsap.killTweensOf(shapes);
        gsap.fromTo(
            shapes,
            { drawSVG: '0%' },
            {
                drawSVG: '100%',
                duration: 0.67,
                ease: 'sine.inOut',
                stagger: 0,
                overwrite: true
            }
        );
    }

    // ---- Icon Transition hooks (JS mode) ----
    function onIconEnter(el, done) {
        // Match the content's upward transition and run the stroke draw simultaneously
        gsap.fromTo(
            el,
            { opacity: 0, y: 24 },
            {
                opacity: 1,
                y: 0,
                duration: 0.4,
                ease: 'power3.out'
            }
        );
        // Start stroke draw at the same time
        animateIconDraw(el);
        // Call done after the container animation finishes
        setTimeout(done, 400);
    }

    function onIconLeave(el, done) {
        gsap.to(el, {
            opacity: 0,
            y: -24,
            duration: 0.25,
            ease: 'power2.in',
            onComplete: done
        });
    }

    // ---- Content Transition hooks (JS mode) ----
    function onContentEnter(el, done) {
        gsap.fromTo(
            el,
            { opacity: 0, y: 24 },
            {
                opacity: 1,
                y: 0,
                duration: 0.4,
                ease: 'power3.out',
                onComplete: done
            }
        );
    }

    function onContentLeave(el, done) {
        gsap.to(el, {
            opacity: 0,
            y: -24,
            duration: 0.25,
            ease: 'power2.in',
            onComplete: done
        });
    }

    /**
     * Entrance animation for the whole shell (fade + scale in).
     */
    function playOpenAnimation() {
        const el = rootRef.value;
        if (!el) return;
        gsap.fromTo(
            el,
            { opacity: 0, scale: 0.92 },
            {
                opacity: 1,
                scale: 1,
                duration: 0.4,
                ease: 'power2.out',
                overwrite: true
            }
        );
    }

    /**
     * Closing animation for the whole shell (fade + scale out).
     * @returns {Promise<void>}
     */
    async function playCloseAnimation() {
        const el = rootRef.value;
        if (!el) return;
        // A fast open→close can leave the entrance tween mid-flight
        gsap.killTweensOf(el);
        await new Promise((resolve) => {
            gsap.to(el, {
                opacity: 0,
                scale: 0.92,
                duration: 0.4,
                ease: 'power2.in',
                onComplete: resolve
            });
        });
    }

    onUnmounted(() => {
        // Kill any lingering GSAP tweens on this component's elements
        if (rootRef.value) {
            gsap.killTweensOf(rootRef.value);
        }
        if (iconWrapRef.value) {
            gsap.killTweensOf(iconWrapRef.value);
            gsap.killTweensOf(iconWrapRef.value.querySelectorAll('*'));
        }
        if (contentRef.value) {
            gsap.killTweensOf(contentRef.value);
        }
    });

    defineExpose({ playOpenAnimation, playCloseAnimation });
</script>

<style scoped>
    .wizard-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 192px;
        width: 100%;
        height: 100%;
        padding: 40px;
        overflow: hidden;
        position: relative;
        z-index: 50;
        background-color: var(--background);
    }

    /* ---- Top bar ---- */
    .wiz-header {
        position: absolute;
        top: 24px;
        left: 36px;
        right: 36px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
    }

    .wiz-step-counter {
        font-size: 13px;
        font-weight: 500;
    }

    .wiz-progress {
        position: absolute;
        top: 78px;
        left: 36px;
        right: 36px;
        display: flex;
        gap: 6px;
    }

    .wiz-progress-segment {
        flex: 1;
        height: 4px;
        border-radius: 999px;
        background-color: var(--muted-foreground);
        opacity: 0.2;
        transition:
            opacity 0.3s ease,
            background-color 0.3s ease;
    }

    .wiz-progress-segment.active {
        opacity: 1;
        background-color: var(--primary);
    }

    /* ---- Left icon ---- */
    .wiz-left {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        width: 140px;
        height: 140px;
        flex: none;
    }

    .wiz-icon-wrap {
        position: absolute;
        inset: 0;
        margin: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 140px;
        height: 140px;
        will-change: transform, opacity;
    }

    /* Icon/slot content fills the wrap (slot content is authored in the
       parent, so reach it with :deep) */
    .wiz-icon-wrap :deep(img),
    .wiz-icon-wrap :deep(svg) {
        display: block;
        width: 100%;
        height: 100%;
    }

    /* ---- Right content ---- */
    .wiz-right {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .wiz-content {
        width: 440px;
        max-width: 440px;
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 16px;
        will-change: transform, opacity;
    }

    /* Panel chrome shared by every wizard (slot content → :deep) */
    .wiz-content :deep(.wiz-panel) {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .wiz-content :deep(.wiz-title) {
        margin: 0;
        font-size: 26px;
        font-weight: 800;
        letter-spacing: -0.02em;
    }

    .wiz-content :deep(.wiz-desc) {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
    }

    .wiz-content :deep(.wiz-actions) {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .wiz-content :deep(.wiz-actions > *) {
        width: 100%;
    }

    /* ---- Responsive: keep the layout usable in smaller windows ---- */
    @media (max-width: 900px) {
        .wizard-shell {
            gap: 48px;
            padding: 40px 24px;
        }

        .wiz-left,
        .wiz-icon-wrap {
            width: 100px;
            height: 100px;
        }

        .wiz-content {
            width: min(440px, calc(100vw - 200px));
        }
    }

    @media (max-width: 640px) {
        .wiz-left {
            display: none;
        }
    }
</style>
