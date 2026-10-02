<template>
    <TooltipWrapper side="top" :content="t('common.actions.refresh')">
        <Button
            variant="outline"
            size="icon-lg"
            class="rounded-full"
            :ariaLabel="t('common.actions.refresh')"
            :disabled="loading"
            @click="$emit('click')">
            <Spinner v-if="loading" />
            <RefreshCw v-else />
        </Button>
    </TooltipWrapper>
</template>

<script setup>
    import { RefreshCw } from 'lucide-vue-next';
    import { useI18n } from 'vue-i18n';
    import { Button } from '@/components/ui/button';
    import { Spinner } from '@/components/ui/spinner';
    import { TooltipWrapper } from '@/components/ui/tooltip';

    defineProps({
        loading: {
            type: Boolean,
            default: false
        }
    });

    defineEmits(['click']);

    const { t } = useI18n();
</script>
