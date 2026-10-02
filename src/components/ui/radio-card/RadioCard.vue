<script setup>
    import { cn } from '@/lib/utils';
    import { RadioGroupItem } from '@/components/ui/radio-group';

    const props = defineProps({
        id: { type: String, required: true },
        value: { type: null, required: true },
        title: { type: String, required: true },
        description: { type: String, default: '' },
        class: { type: null, required: false }
    });
</script>

<template>
    <label
        :for="id"
        data-slot="radio-card"
        :class="
            cn(
                'flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[[data-state=checked]]:border-primary',
                props.class
            )
        ">
        <RadioGroupItem :id="id" :value="value" :aria-label="title" />
        <div class="flex flex-col gap-1">
            <span class="text-sm leading-none font-medium select-none">{{ title }}</span>
            <p v-if="description" class="text-xs text-muted-foreground">{{ description }}</p>
        </div>
    </label>
</template>
