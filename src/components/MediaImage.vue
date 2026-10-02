<template>
    <img data-slot="media-image" :src="renderSrc" :loading="loading" />
</template>

<script setup>
    import { computed, toRef } from 'vue';
    import { MEDIA_PLACEHOLDER_SRC, useMediaSrc } from '@/composables/useMediaSrc';

    const props = defineProps({
        src: { type: String, default: '' },
        loading: { type: String, required: false, default: 'lazy' }
    });

    const sourceRef = toRef(props, 'src');
    // 会话内缓存解析；解析期间渲染占位图避免布局塌陷
    const { displaySrc } = useMediaSrc(sourceRef, {
        lazy: props.loading === 'lazy'
    });

    // 空地址保持原生行为（不渲染占位图，交由调用方的 v-else / @error 兜底）
    const renderSrc = computed(() => {
        if (!props.src) {
            return displaySrc.value;
        }
        return displaySrc.value || MEDIA_PLACEHOLDER_SRC;
    });
</script>
