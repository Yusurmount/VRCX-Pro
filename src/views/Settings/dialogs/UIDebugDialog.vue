<template>
    <Dialog :open="uidDialog" @update:open="(open) => !open && closeDialog()">
        <DialogContent class="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>{{ t('view.settings.advanced.advanced.ui_debug.header') }}</DialogTitle>
            </DialogHeader>
            <div class="grid gap-3">
                <button
                    class="ui-debug-row border-border bg-card hover:border-ring hover:bg-accent"
                    @click="showOobe">
                    <span class="ui-debug-name text-foreground">{{ t('view.settings.advanced.advanced.ui_debug.oobe.label') }}</span>
                    <span class="ui-debug-desc text-muted-foreground">{{ t('view.settings.advanced.advanced.ui_debug.oobe.desc') }}</span>
                </button>

                <button
                    class="ui-debug-row border-border bg-card hover:border-ring hover:bg-accent"
                    @click="resetOobeAndShow">
                    <span class="ui-debug-name text-foreground">{{ t('view.settings.advanced.advanced.ui_debug.reset_oobe.label') }}</span>
                    <span class="ui-debug-desc text-muted-foreground">{{ t('view.settings.advanced.advanced.ui_debug.reset_oobe.desc') }}</span>
                </button>

                <button
                    class="ui-debug-row border-border bg-card hover:border-ring hover:bg-accent"
                    @click="showWelcomeDialog">
                    <span class="ui-debug-name text-foreground">
                        {{ t('view.settings.advanced.advanced.ui_debug.welcome.label') }}
                    </span>
                    <span class="ui-debug-desc text-muted-foreground">{{ t('view.settings.advanced.advanced.ui_debug.welcome.desc') }}</span>
                </button>

                <button
                    class="ui-debug-row border-border bg-card hover:border-ring hover:bg-accent"
                    @click="showTestToast">
                    <span class="ui-debug-name text-foreground">{{ t('view.settings.advanced.advanced.ui_debug.toast.label') }}</span>
                    <span class="ui-debug-desc text-muted-foreground">{{ t('view.settings.advanced.advanced.ui_debug.toast.desc') }}</span>
                </button>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { useI18n } from 'vue-i18n';
    import { useRouter } from 'vue-router';
    import { toast } from 'vue-sonner';

    import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import configRepository from '@/services/config';
    import { resetOobe } from '@/services/oobe';

    defineProps({
        uidDialog: {
            type: Boolean,
            default: false
        }
    });

    const emit = defineEmits(['update:uidDialog']);
    const { t } = useI18n();
    const router = useRouter();

    /**
     *
     */
    function closeDialog() {
        emit('update:uidDialog', false);
    }

    /**
     * Open the OOBE wizard from step 1 (regardless of login state).
     */
    function showOobe() {
        router.push({ name: 'oobe', query: { debug: '1' } });
    }

    /**
     * Reset the OOBE completion flag, then reopen the wizard.
     */
    async function resetOobeAndShow() {
        await resetOobe();
        showOobe();
    }

    /**
     * Reset the welcome-dialog seen flag so SpotlightDialog shows again.
     */
    async function showWelcomeDialog() {
        await configRepository.setBool('VRCX_onboarding_welcome_seen', false);
        router.push('/feed');
    }

    /**
     * Show a sample toast notification.
     */
    function showTestToast() {
        toast(t('view.settings.advanced.advanced.ui_debug.toast.message'));
    }
</script>

<style scoped>
    .ui-debug-row {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        width: 100%;
        padding: 12px 14px;
        text-align: left;
        border-radius: var(--radius);
        border-width: 1px;
        border-style: solid;
        cursor: pointer;
        transition:
            background-color 0.15s ease,
            border-color 0.15s ease;
    }

    .ui-debug-name {
        font-size: 14px;
        font-weight: 600;
    }

    .ui-debug-desc {
        font-size: 12.5px;
        line-height: 1.5;
    }
</style>
