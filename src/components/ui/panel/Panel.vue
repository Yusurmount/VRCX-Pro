<script setup>
    import { Primitive } from 'reka-ui';
    import { cn } from '@/lib/utils';

    import { panelVariants } from '.';

    const props = defineProps({
        as: { type: null, required: false, default: 'div' },
        asChild: { type: Boolean, required: false },
        variant: { type: null, required: false },
        padding: { type: null, required: false },
        class: { type: null, required: false }
    });
</script>

<template>
    <Primitive
        data-slot="panel"
        :as="as"
        :as-child="asChild"
        :class="cn(panelVariants({ variant, padding }), props.class)">
        <slot />
    </Primitive>
</template>
