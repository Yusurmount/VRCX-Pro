<script setup>
    import { cn } from '@/lib/utils';
    import { computed } from 'vue';

    const props = defineProps({
        modelValue: { type: String, default: '#ffffff' },
        disabled: { type: Boolean, default: false },
        label: { type: String, default: '' },
        class: { type: null, required: false }
    });

    const emit = defineEmits(['update:modelValue', 'change']);

    const color = computed(() => props.modelValue || '#ffffff');

    function onInput(event) {
        const value = event?.target?.value || '#ffffff';
        emit('update:modelValue', value);
        emit('change', value);
    }
</script>

<template>
    <label
        data-slot="color-input"
        :class="
            cn(
                'relative inline-flex h-8 w-12 shrink-0 cursor-pointer overflow-hidden rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow]',
                'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
                disabled && 'pointer-events-none cursor-not-allowed opacity-50',
                props.class
            )
        ">
        <span class="absolute inset-0" :style="{ backgroundColor: color }" />
        <input
            type="color"
            class="absolute inset-0 size-full cursor-pointer opacity-0"
            :value="color"
            :disabled="disabled"
            :aria-label="label || undefined"
            @input="onInput" />
    </label>
</template>
