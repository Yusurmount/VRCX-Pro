<template>
    <Dialog v-model:open="VRCXUpdateDialog.visible">
        <DialogContent class="gap-0 overflow-hidden p-0 shadow-2xl sm:max-w-xl">
            <DialogHeader class="px-6 pt-6 text-left">
                <DialogTitle class="text-xl tracking-tight">
                    {{ t('dialog.vrcx_updater.header') }}
                </DialogTitle>
            </DialogHeader>
            <div class="px-6 pb-6">
                <section class="mt-5 rounded-2xl border border-border/70 bg-muted/40 px-5 py-6 text-center shadow-xs">
                    <div
                        class="mx-auto flex size-12 items-center justify-center rounded-full border"
                        :class="[updateStatus.tone, updateStatus.borderColor]">
                        <component :is="updateStatus.icon" :class="['size-6', updateStatus.iconClass]" />
                    </div>
                    <h2 class="mt-4 text-lg font-semibold tracking-tight text-foreground">
                        {{ updateStatus.title }}
                    </h2>
                    <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {{ updateStatus.description }}
                    </p>
                    <Progress
                        v-if="updateInProgress"
                        :model-value="updateProgress"
                        class="mt-5 h-2.5 bg-primary/15"
                        aria-label="Update progress" />
                </section>

                <template v-if="!updateInProgress">
                    <button
                        type="button"
                        data-testid="change-log-card"
                        class="mt-4 flex w-full items-center justify-between rounded-xl border border-border/70 bg-card/70 p-4 text-left shadow-xs transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                        @click="openChangeLog">
                        <span class="flex min-w-0 items-center gap-3">
                            <span
                                class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                <FileText class="size-4" />
                            </span>
                            <span class="min-w-0">
                                <span class="block truncate text-sm font-medium text-foreground">
                                    {{ t('dialog.change_log.header') }}
                                </span>
                                <span class="mt-0.5 block truncate text-xs text-muted-foreground">
                                    {{ VRCXUpdateDialog.release || appVersion }}
                                </span>
                            </span>
                        </span>
                        <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
                    </button>
                </template>
            </div>

            <DialogFooter
                class="border-t border-border/70 bg-muted/25 px-6 py-4 sm:items-center"
                :class="updateInProgress ? 'sm:justify-end' : 'sm:justify-between'">
                <Button v-if="updateInProgress" variant="outline" @click="cancelUpdate">
                    <X class="size-4" />
                    {{ t('dialog.vrcx_updater.cancel') }}
                </Button>
                <template v-else>
                    <Button variant="outline" @click="openReleases">
                        <ExternalLink class="size-4" />
                        {{ t('dialog.vrcx_updater.change_version') }}
                    </Button>
                    <Button
                        v-if="showDownload"
                        :variant="showInstall ? 'outline' : 'default'"
                        :disabled="checkingForVRCXUpdate"
                        @click="installVRCXUpdate">
                        <CloudDownload class="size-4" />
                        {{ t('dialog.vrcx_updater.download') }}
                    </Button>
                    <Button v-if="showInstall" @click="restartVRCX(true)">
                        <PackageCheck class="size-4" />
                        {{ t('dialog.vrcx_updater.install') }}
                    </Button>
                </template>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { computed } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import {
        ChevronRight,
        CircleCheck,
        CloudDownload,
        ExternalLink,
        FileText,
        Loader2,
        PackageCheck,
        X
    } from 'lucide-vue-next';

    import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Progress } from '@/components/ui/progress';
    import { openExternalLink } from '@/shared/utils';
    import { useVRCXUpdaterStore } from '../../stores';

    const VRCXUpdaterStore = useVRCXUpdaterStore();

    const {
        appVersion,
        checkingForVRCXUpdate,
        VRCXUpdateDialog,
        pendingVRCXInstall,
        updateInProgress,
        updateProgress
    } = storeToRefs(VRCXUpdaterStore);
    const { installVRCXUpdate, restartVRCX, showChangeLogDialog, updateProgressText, cancelUpdate } = VRCXUpdaterStore;

    const { t } = useI18n();

    const normalizeVersion = (value) =>
        String(value || '')
            .replace(' (Linux)', '')
            .replace(/^VRCX-Pro(?:\s+Nightly)?\s+/, '')
            .replace(/^v/, '')
            .trim();

    const isUpToDate = computed(
        () => normalizeVersion(VRCXUpdateDialog.value.release) === normalizeVersion(appVersion.value)
    );

    const updateStatus = computed(() => {
        if (updateInProgress.value) {
            return {
                icon: Loader2,
                iconClass: 'animate-spin text-primary',
                tone: 'bg-primary/10',
                borderColor: 'border-primary/20',
                title: t('dialog.vrcx_updater.downloading'),
                description: updateProgressText()
            };
        }

        if (checkingForVRCXUpdate.value) {
            return {
                icon: Loader2,
                iconClass: 'animate-spin text-primary',
                tone: 'bg-primary/10',
                borderColor: 'border-primary/20',
                title: t('dialog.vrcx_updater.checking'),
                description: t('dialog.vrcx_updater.checking_description')
            };
        }

        if (VRCXUpdateDialog.value.updatePending) {
            return {
                icon: PackageCheck,
                iconClass: 'text-primary',
                tone: 'bg-primary/10',
                borderColor: 'border-primary/20',
                title: pendingVRCXInstall.value || t('dialog.vrcx_updater.header'),
                description: t('dialog.vrcx_updater.ready_for_update')
            };
        }

        if (isUpToDate.value) {
            return {
                icon: CircleCheck,
                iconClass: 'text-emerald-600 dark:text-emerald-400',
                tone: 'bg-emerald-500/10',
                borderColor: 'border-emerald-500/20',
                title: t('dialog.vrcx_updater.latest_version'),
                description: `${t('dialog.vrcx_updater.current_version')} · ${appVersion.value}`
            };
        }

        return {
            icon: CloudDownload,
            iconClass: 'text-primary',
            tone: 'bg-primary/10',
            borderColor: 'border-primary/20',
            title: VRCXUpdateDialog.value.release || t('dialog.vrcx_updater.header'),
            description: t('dialog.vrcx_updater.update_available')
        };
    });

    const showDownload = computed(
        () => !isUpToDate.value && VRCXUpdateDialog.value.release !== pendingVRCXInstall.value
    );
    const showInstall = computed(() => !updateInProgress.value && Boolean(pendingVRCXInstall.value));

    const openChangeLog = async () => {
        VRCXUpdateDialog.value.visible = false;
        await showChangeLogDialog();
    };

    const openReleases = () => openExternalLink('https://github.com/Yusurmount/VRCX-Pro/releases');
</script>
