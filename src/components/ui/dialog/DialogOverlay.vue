<script setup>
    import { DialogOverlay } from 'reka-ui';
    import { cn } from '@/lib/utils';
    import { reactiveOmit } from '@vueuse/core';
    import { storeToRefs } from 'pinia';
    import { useGeneralSettingsStore } from '@/stores/settings/general';
    import { onBeforeUnmount, onMounted, ref } from 'vue';

    const props = defineProps({
        forceMount: { type: Boolean, required: false },
        asChild: { type: Boolean, required: false },
        as: { type: null, required: false },
        class: { type: null, required: false }
    });

    const delegatedProps = reactiveOmit(props, 'class');
    const { disableGpuAcceleration } = storeToRefs(useGeneralSettingsStore());

    // Electron 主进程无条件 app.disableHardwareAcceleration()（上游代码），
    // 导致 gpu_compositing = disabled_software，全屏 backdrop-filter 走软件渲染会严重掉帧。
    // 因此仅在 GPU 合成可用时应用背景模糊；浏览器/CEF 下无 window.electron，默认启用保持原行为。
    const gpuCompositingEnabled = ref(!window.electron);
    try {
        window.electron?.getGpuFeatureStatus?.().then((status) => {
            gpuCompositingEnabled.value = status?.gpu_compositing === 'enabled';
        });
    } catch {}

    // #region debug-point A:overlay-lifecycle
    const __dbg = {
        url: 'http://127.0.0.1:7777/event',
        sid: 'dialog-blur-lag',
        runId: 'post-fix',
        start: 0,
        prev: 0,
        timer: null,
        frames: []
    };
    const __dbgSend = (hypothesisId, msg, data) => {
        try {
            fetch(__dbg.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: __dbg.sid,
                    runId: __dbg.runId,
                    hypothesisId,
                    location: 'DialogOverlay.vue',
                    msg: '[DEBUG] ' + msg,
                    data,
                    ts: Date.now()
                })
            }).catch(() => {});
        } catch {}
    };
    const __dbgStats = () => {
        const f = __dbg.frames;
        if (!f.length) return { frames: 0 };
        const sorted = [...f].sort((a, b) => a - b);
        const avg = f.reduce((s, v) => s + v, 0) / f.length;
        return {
            frames: f.length,
            avgMs: +avg.toFixed(1),
            p95Ms: sorted[Math.floor(sorted.length * 0.95)],
            maxMs: sorted[sorted.length - 1],
            long50ms: f.filter((v) => v > 50).length
        };
    };
    onMounted(() => {
        __dbg.start = performance.now();
        __dbg.prev = performance.now();
        __dbgSend('A', 'overlay mounted', {
            blur: !disableGpuAcceleration.value && gpuCompositingEnabled.value,
            gpuCompositingEnabled: gpuCompositingEnabled.value,
            w: window.innerWidth,
            h: window.innerHeight,
            dpr: window.devicePixelRatio
        });
        const sample = (t) => {
            if (__dbg.frames.length >= 3600) return;
            const d = t - __dbg.prev;
            __dbg.prev = t;
            __dbg.frames.push(d);
            __dbg.timer = requestAnimationFrame(sample);
        };
        __dbg.timer = requestAnimationFrame(sample);
    });
    onBeforeUnmount(() => {
        if (__dbg.timer) cancelAnimationFrame(__dbg.timer);
        __dbgSend('A', 'overlay unmounted', {
            blur: !disableGpuAcceleration.value && gpuCompositingEnabled.value,
            gpuCompositingEnabled: gpuCompositingEnabled.value,
            durationMs: Math.round(performance.now() - __dbg.start),
            ...__dbgStats()
        });
    });
    // #endregion
</script>

<template>
    <DialogOverlay
        data-slot="dialog-overlay"
        v-bind="delegatedProps"
        :class="
            cn(
                'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40',
                !disableGpuAcceleration && gpuCompositingEnabled && 'backdrop-blur-xs',
                props.class
            )
        ">
        <slot />
    </DialogOverlay>
</template>
