<script setup>
    import { AvatarImage } from 'reka-ui';
    import { computed, toRef } from 'vue';
    import { useMediaSrc } from '@/composables/useMediaSrc';

    const props = defineProps({
        src: { type: String, required: true },
        referrerPolicy: { type: null, required: false },
        crossOrigin: { type: null, required: false },
        asChild: { type: Boolean, required: false },
        as: { type: null, required: false },
        loading: { type: String, required: false, default: 'lazy' }
    });

    const sourceRef = toRef(props, 'src');
    // 会话内缓存解析；lazy 语义与原生一致（默认懒加载，eager 立即解析）
    const { displaySrc } = useMediaSrc(sourceRef, {
        lazy: props.loading !== 'eager'
    });

    const passthrough = computed(() => {
        const rest = { ...props };
        delete rest.src;
        return rest;
    });
</script>

<template>
    <AvatarImage
        v-if="displaySrc"
        data-slot="avatar-image"
        v-bind="passthrough"
        :src="displaySrc"
        class="aspect-square size-full">
        <slot />
    </AvatarImage>
</template>
