<template>
    <div class="flex items-center text-xs">
        <div
            class="name flex w-[225px] min-w-[225px] items-center break-words pt-[7px]"
            :style="{ width: longLabel ? '300px' : undefined }">
            {{ label }}
            <TooltipWrapper v-if="tooltip" side="top" :content="tooltip">
                <Info class="ml-[3px]" />
            </TooltipWrapper>
        </div>

        <Switch class="ml-2" :model-value="value" @update:modelValue="change" :disabled="disabled" />
    </div>
</template>

<script setup>
    import { Info } from 'lucide-vue-next';

    import { Switch } from '../../../components/ui/switch';
    defineProps({
        label: String,
        value: Boolean,
        tooltip: String,
        disabled: Boolean,
        longLabel: Boolean
    });

    const emit = defineEmits(['change']);

    /**
     *
     * @param event
     */
    function change(event) {
        emit('change', event);
    }
</script>
