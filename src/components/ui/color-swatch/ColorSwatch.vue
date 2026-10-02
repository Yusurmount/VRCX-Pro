<script setup>
    import { cn } from '@/lib/utils';

    import { colorSwatchVariants } from '.';

    const props = defineProps({
        color: { type: String, required: true },
        selected: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
        size: { type: String, default: 'default' },
        label: { type: String, default: '' },
        class: { type: null, required: false }
    });

    defineEmits(['select']);
</script>

<template>
    <button
        type="button"
        data-slot="color-swatch"
        :class="
            cn(
                colorSwatchVariants({ size }),
                selected && 'border-ring ring-1 ring-ring ring-offset-1 ring-offset-background',
                props.class
            )
        "
        :style="{ backgroundColor: color }"
        :disabled="disabled"
        :aria-label="label || undefined"
        :aria-pressed="selected"
        @click="$emit('select', color)">
        <span class="sr-only">{{ label || color }}</span>
    </button>
</template>
