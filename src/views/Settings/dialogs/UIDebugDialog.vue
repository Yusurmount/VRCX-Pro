<template>
    <Dialog :open="uidDialog" @update:open="(open) => !open && closeDialog()">
        <DialogContent class="sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle>{{ t('view.settings.advanced.advanced.ui_debug.header') }}</DialogTitle>
            </DialogHeader>

            <Tabs default-value="notifications">
                <TabsList class="w-full">
                    <TabsTrigger value="notifications">
                        {{ t('view.settings.advanced.advanced.ui_debug.tabs.notifications') }}
                    </TabsTrigger>
                    <TabsTrigger value="onboarding">
                        {{ t('view.settings.advanced.advanced.ui_debug.tabs.onboarding') }}
                    </TabsTrigger>
                    <TabsTrigger value="dialogs">
                        {{ t('view.settings.advanced.advanced.ui_debug.tabs.dialogs') }}
                    </TabsTrigger>
                    <TabsTrigger value="components">
                        {{ t('view.settings.advanced.advanced.ui_debug.tabs.components') }}
                    </TabsTrigger>
                    <TabsTrigger value="app_state">
                        {{ t('view.settings.advanced.advanced.ui_debug.tabs.app_state') }}
                    </TabsTrigger>
                    <TabsTrigger value="previews">
                        {{ t('view.settings.advanced.advanced.ui_debug.tabs.previews') }}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="notifications">
                    <div class="grid gap-3">
                        <button
                            v-for="item in notificationItems"
                            :key="item.id"
                            class="ui-debug-row border-border bg-card hover:border-ring hover:bg-accent"
                            @click="item.run">
                            <span class="ui-debug-name text-foreground">{{ item.label }}</span>
                            <span class="ui-debug-desc text-muted-foreground">{{ item.desc }}</span>
                        </button>
                    </div>
                </TabsContent>

                <TabsContent value="onboarding">
                    <div class="grid gap-3">
                        <button
                            v-for="item in onboardingItems"
                            :key="item.id"
                            class="ui-debug-row border-border bg-card hover:border-ring hover:bg-accent"
                            @click="item.run">
                            <span class="ui-debug-name text-foreground">{{ item.label }}</span>
                            <span class="ui-debug-desc text-muted-foreground">{{ item.desc }}</span>
                        </button>
                    </div>
                </TabsContent>

                <TabsContent value="dialogs">
                    <div class="grid gap-3">
                        <button
                            v-for="item in dialogItems"
                            :key="item.id"
                            class="ui-debug-row border-border bg-card hover:border-ring hover:bg-accent"
                            @click="item.run">
                            <span class="ui-debug-name text-foreground">{{ item.label }}</span>
                            <span class="ui-debug-desc text-muted-foreground">{{ item.desc }}</span>
                        </button>
                    </div>
                </TabsContent>

                <TabsContent value="components">
                    <p class="text-muted-foreground mb-3 text-xs">
                        {{ t('view.settings.advanced.advanced.ui_debug.gallery.hint') }}
                    </p>
                    <UIComponentGallery />
                </TabsContent>

                <TabsContent value="app_state">
                    <div class="space-y-4">
                        <section>
                            <h3 class="text-sm font-semibold text-foreground mb-2">
                                {{ t(tk('app_state.current_user')) }}
                            </h3>
                            <div class="rounded-md border p-3 text-xs font-mono space-y-1">
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">displayName:</span>
                                    <span class="text-foreground">{{ currentUser.displayName ?? '—' }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">id:</span>
                                    <span class="text-foreground">{{ currentUser.id ?? '—' }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">status:</span>
                                    <span class="text-foreground">{{ currentUser.status ?? '—' }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">statusDescription:</span>
                                    <span class="text-foreground truncate max-w-[200px]">{{ currentUser.statusDescription ?? '—' }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">location:</span>
                                    <span class="text-foreground truncate max-w-[200px]">{{ currentUser.location ?? '—' }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">$trustLevel:</span>
                                    <span class="text-foreground">{{ currentUser.$trustLevel ?? '—' }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">$isVRCPlus:</span>
                                    <span class="text-foreground">{{ currentUser.$isVRCPlus ?? '—' }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">friendCount:</span>
                                    <span class="text-foreground">{{ currentUser.friends?.length ?? '—' }}</span>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h3 class="text-sm font-semibold text-foreground mb-2">
                                {{ t(tk('app_state.appearance_settings')) }}
                            </h3>
                            <div class="rounded-md border p-3 text-xs font-mono space-y-1">
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">appLanguage:</span>
                                    <span class="text-foreground">{{ appearanceSettings.appLanguage }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">themeMode:</span>
                                    <span class="text-foreground">{{ appearanceSettings.themeMode }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">isDarkMode:</span>
                                    <span class="text-foreground">{{ appearanceSettings.isDarkMode }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">tableDensity:</span>
                                    <span class="text-foreground">{{ appearanceSettings.tableDensity }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">displayVRCProfileCosmetics:</span>
                                    <span class="text-foreground">{{ appearanceSettings.displayVRCProfileCosmetics }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">sidebarCosmetics:</span>
                                    <span class="text-foreground">{{ appearanceSettings.sidebarCosmetics }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">hideNicknames:</span>
                                    <span class="text-foreground">{{ appearanceSettings.hideNicknames }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">randomUserColours:</span>
                                    <span class="text-foreground">{{ appearanceSettings.randomUserColours }}</span>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h3 class="text-sm font-semibold text-foreground mb-2">
                                {{ t(tk('app_state.store_counts')) }}
                            </h3>
                            <div class="rounded-md border p-3 text-xs font-mono space-y-1">
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">cachedUsers:</span>
                                    <span class="text-foreground">{{ userStore.cachedUsers?.size ?? 0 }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">cachedProfileEffects:</span>
                                    <span class="text-foreground">{{ userStore.cachedProfileEffects?.size ?? 0 }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">cachedIconFrames:</span>
                                    <span class="text-foreground">{{ userStore.cachedIconFrames?.size ?? 0 }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">cachedNameplateEffects:</span>
                                    <span class="text-foreground">{{ userStore.cachedNameplateEffects?.size ?? 0 }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">currentTravelers:</span>
                                    <span class="text-foreground">{{ userStore.currentTravelers?.size ?? 0 }}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-muted-foreground">customUserTags:</span>
                                    <span class="text-foreground">{{ userStore.customUserTags?.size ?? 0 }}</span>
                                </div>
                            </div>
                        </section>
                    </div>
                </TabsContent>

                <TabsContent value="previews">
                    <div class="grid gap-3">
                        <button
                            v-for="item in previewItems"
                            :key="item.id"
                            class="ui-debug-row border-border bg-card hover:border-ring hover:bg-accent"
                            @click="item.run">
                            <span class="ui-debug-name text-foreground">{{ item.label }}</span>
                            <span class="ui-debug-desc text-muted-foreground">{{ item.desc }}</span>
                        </button>
                    </div>
                </TabsContent>
            </Tabs>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { computed } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { useRouter } from 'vue-router';
    import { toast } from 'vue-sonner';

    import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import configRepository from '@/services/config';
    import { resetOobe } from '@/services/oobe';
    import { getLatestWhatsNewRelease } from '@/shared/constants/whatsNewReleases';
    import { useAppearanceSettingsStore } from '@/stores/settings/appearance';
    import { useModalStore } from '@/stores/modal';
    import { useUserStore } from '@/stores/user';
    import { useVRCXUpdaterStore } from '@/stores/vrcxUpdater';

    import UIComponentGallery from './UIComponentGallery.vue';

    defineProps({
        uidDialog: {
            type: Boolean,
            default: false
        }
    });

    const emit = defineEmits(['update:uidDialog']);
    const { t } = useI18n();
    const router = useRouter();
    const modalStore = useModalStore();
    const userStore = useUserStore();
    const appearanceSettings = useAppearanceSettingsStore();
    const vrcxUpdater = useVRCXUpdaterStore();

    const currentUser = computed(() => userStore.currentUser ?? {});

    /**
     * @param {string} suffix
     * @returns {string}
     */
    function tk(suffix) {
        return `view.settings.advanced.advanced.ui_debug.${suffix}`;
    }

    /**
     *
     */
    function closeDialog() {
        emit('update:uidDialog', false);
    }

    // --- Notifications ---

    /**
     *
     */
    function showDefaultToast() {
        toast(t(tk('toast.title')), {
            description: t(tk('toast.description'))
        });
    }

    /**
     *
     */
    function showSuccessToast() {
        toast.success(t(tk('toast.title')), {
            description: t(tk('toast.description'))
        });
    }

    /**
     *
     */
    function showErrorToast() {
        toast.error(t(tk('toast.title')), {
            description: t(tk('toast.description'))
        });
    }

    /**
     *
     */
    function showWarningToast() {
        toast.warning(t(tk('toast.title')), {
            description: t(tk('toast.description'))
        });
    }

    /**
     *
     */
    function showInfoToast() {
        toast.info(t(tk('toast.title')), {
            description: t(tk('toast.description'))
        });
    }

    /**
     * Show a loading toast, then update it to a success toast.
     */
    function showLoadingToast() {
        const id = toast.loading(t(tk('toast.loading_message')), {
            description: t(tk('toast.description'))
        });
        setTimeout(() => {
            toast.success(t(tk('toast.loading_message')), {
                id,
                description: t(tk('toast.description'))
            });
        }, 2000);
    }

    /**
     * Show a toast driven by a promise that randomly resolves or rejects.
     */
    function showPromiseToast() {
        const promise = new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() > 0.5) {
                    resolve();
                } else {
                    reject(new Error('failed'));
                }
            }, 2500);
        });
        toast.promise(promise, {
            loading: t(tk('toast.loading_message')),
            success: t(tk('toast.promise_success')),
            error: t(tk('toast.promise_error'))
        });
    }

    /**
     *
     */
    function showActionToast() {
        toast(t(tk('toast.title')), {
            description: t(tk('toast.description')),
            action: {
                label: t(tk('toast.action')),
                onClick: () => toast.success(t(tk('toast.action_clicked')))
            }
        });
    }

    /**
     *
     */
    function showPersistentToast() {
        toast(t(tk('toast.title')), {
            description: t(tk('toast.description')),
            duration: Infinity
        });
    }

    /**
     *
     */
    function dismissAllToasts() {
        toast.dismiss();
    }

    // --- Onboarding ---

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
     * Open the What's New dialog for the latest known release.
     */
    function showLatestWhatsNewDialog() {
        const release = getLatestWhatsNewRelease();
        if (!release) {
            return;
        }
        vrcxUpdater.whatsNewDialog = {
            visible: true,
            titleKey: release.titleKey,
            subtitleKey: release.subtitleKey,
            items: release.items.map((item) => ({ ...item }))
        };
    }

    /**
     * Open the changelog dialog.
     */
    async function showChangeLogDialog() {
        await vrcxUpdater.showChangeLogDialog();
    }

    // --- Global dialogs ---

    /**
     * @param {'ok' | 'cancel' | 'dismiss' | 'replaced'} reason
     */
    function reportResult(reason) {
        toast.info(t(tk('dialogs.result'), { reason }));
    }

    /**
     * @param {string} title
     * @returns {string}
     */
    function demoDescription() {
        return t(tk('dialogs.demo_description'));
    }

    /**
     *
     */
    async function showAlertDialog() {
        const result = await modalStore.alert({
            title: t(tk('dialogs.alert.label')),
            description: demoDescription()
        });
        reportResult(result.reason);
    }

    /**
     *
     */
    async function showConfirmDialog() {
        const result = await modalStore.confirm({
            title: t(tk('dialogs.confirm.label')),
            description: demoDescription()
        });
        reportResult(result.reason);
    }

    /**
     *
     */
    async function showDestructiveConfirmDialog() {
        const result = await modalStore.confirm({
            title: t(tk('dialogs.confirm_destructive.label')),
            description: demoDescription(),
            destructive: true,
            dismissible: false
        });
        reportResult(result.reason);
    }

    /**
     *
     */
    async function showPromptDialog() {
        const result = await modalStore.prompt({
            title: t(tk('dialogs.prompt.label')),
            description: demoDescription()
        });
        reportResult(result.reason);
    }

    /**
     * Show a prompt that validates the input against a pattern.
     */
    async function showValidationPromptDialog() {
        const result = await modalStore.prompt({
            title: t(tk('dialogs.prompt_validation.label')),
            description: demoDescription(),
            pattern: /^[a-zA-Z0-9_]{3,16}$/
        });
        reportResult(result.reason);
    }

    /**
     * @param {'totp' | 'emailOtp' | 'otp'} mode
     * @param {string} title
     */
    async function showOtpDialog(mode, title) {
        const result = await modalStore.otpPrompt({
            title,
            description: demoDescription(),
            mode
        });
        reportResult(result.reason);
    }

    /**
     *
     */
    async function showVrcxUpdateDialog() {
        await vrcxUpdater.showVRCXUpdateDialog();
    }

    const notificationItems = computed(() => [
        {
            id: 'default',
            label: t(tk('toast.items.default.label')),
            desc: t(tk('toast.items.default.desc')),
            run: showDefaultToast
        },
        {
            id: 'success',
            label: t(tk('toast.items.success.label')),
            desc: t(tk('toast.items.success.desc')),
            run: showSuccessToast
        },
        {
            id: 'error',
            label: t(tk('toast.items.error.label')),
            desc: t(tk('toast.items.error.desc')),
            run: showErrorToast
        },
        {
            id: 'warning',
            label: t(tk('toast.items.warning.label')),
            desc: t(tk('toast.items.warning.desc')),
            run: showWarningToast
        },
        {
            id: 'info',
            label: t(tk('toast.items.info.label')),
            desc: t(tk('toast.items.info.desc')),
            run: showInfoToast
        },
        {
            id: 'loading',
            label: t(tk('toast.items.loading.label')),
            desc: t(tk('toast.items.loading.desc')),
            run: showLoadingToast
        },
        {
            id: 'promise',
            label: t(tk('toast.items.promise.label')),
            desc: t(tk('toast.items.promise.desc')),
            run: showPromiseToast
        },
        {
            id: 'action',
            label: t(tk('toast.items.action.label')),
            desc: t(tk('toast.items.action.desc')),
            run: showActionToast
        },
        {
            id: 'persistent',
            label: t(tk('toast.items.persistent.label')),
            desc: t(tk('toast.items.persistent.desc')),
            run: showPersistentToast
        },
        {
            id: 'dismiss_all',
            label: t(tk('toast.items.dismiss_all.label')),
            desc: t(tk('toast.items.dismiss_all.desc')),
            run: dismissAllToasts
        }
    ]);

    const onboardingItems = computed(() => [
        {
            id: 'oobe',
            label: t(tk('onboarding.oobe.label')),
            desc: t(tk('onboarding.oobe.desc')),
            run: showOobe
        },
        {
            id: 'reset_oobe',
            label: t(tk('onboarding.reset_oobe.label')),
            desc: t(tk('onboarding.reset_oobe.desc')),
            run: resetOobeAndShow
        },
        {
            id: 'welcome',
            label: t(tk('onboarding.welcome.label')),
            desc: t(tk('onboarding.welcome.desc')),
            run: showWelcomeDialog
        },
        {
            id: 'whats_new',
            label: t(tk('onboarding.whats_new.label')),
            desc: t(tk('onboarding.whats_new.desc')),
            run: showLatestWhatsNewDialog
        },
        {
            id: 'changelog',
            label: t(tk('onboarding.changelog.label')),
            desc: t(tk('onboarding.changelog.desc')),
            run: showChangeLogDialog
        }
    ]);

    const dialogItems = computed(() => [
        {
            id: 'alert',
            label: t(tk('dialogs.alert.label')),
            desc: t(tk('dialogs.alert.desc')),
            run: showAlertDialog
        },
        {
            id: 'confirm',
            label: t(tk('dialogs.confirm.label')),
            desc: t(tk('dialogs.confirm.desc')),
            run: showConfirmDialog
        },
        {
            id: 'confirm_destructive',
            label: t(tk('dialogs.confirm_destructive.label')),
            desc: t(tk('dialogs.confirm_destructive.desc')),
            run: showDestructiveConfirmDialog
        },
        {
            id: 'prompt',
            label: t(tk('dialogs.prompt.label')),
            desc: t(tk('dialogs.prompt.desc')),
            run: showPromptDialog
        },
        {
            id: 'prompt_validation',
            label: t(tk('dialogs.prompt_validation.label')),
            desc: t(tk('dialogs.prompt_validation.desc')),
            run: showValidationPromptDialog
        },
        {
            id: 'otp_totp',
            label: t(tk('dialogs.otp_totp.label')),
            desc: t(tk('dialogs.otp_totp.desc')),
            run: () => showOtpDialog('totp', t(tk('dialogs.otp_totp.label')))
        },
        {
            id: 'otp_email',
            label: t(tk('dialogs.otp_email.label')),
            desc: t(tk('dialogs.otp_email.desc')),
            run: () => showOtpDialog('emailOtp', t(tk('dialogs.otp_email.label')))
        },
        {
            id: 'otp_recovery',
            label: t(tk('dialogs.otp_recovery.label')),
            desc: t(tk('dialogs.otp_recovery.desc')),
            run: () => showOtpDialog('otp', t(tk('dialogs.otp_recovery.label')))
        },
        {
            id: 'update',
            label: t(tk('dialogs.update.label')),
            desc: t(tk('dialogs.update.desc')),
            run: showVrcxUpdateDialog
        }
    ]);

    // --- Dialog Previews ---

    function previewEditProfile() {
        userStore.showEditProfileDialog();
    }

    function previewUserDialog() {
        if (userStore.currentUser?.id) {
            userStore.setUserDialogVisible(true, userStore.currentUser.id);
        } else {
            toast.warning(t(tk('previews.no_user')));
        }
    }

    const previewItems = computed(() => [
        {
            id: 'edit_profile',
            label: t(tk('previews.edit_profile.label')),
            desc: t(tk('previews.edit_profile.desc')),
            run: previewEditProfile
        },
        {
            id: 'user_dialog',
            label: t(tk('previews.user_dialog.label')),
            desc: t(tk('previews.user_dialog.desc')),
            run: previewUserDialog
        },
        {
            id: 'data_export',
            label: t(tk('previews.data_export.label')),
            desc: t(tk('previews.data_export.desc')),
            run: () => userStore.userDialog.dataExportDialog = true
        }
    ]);
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
