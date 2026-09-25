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

                <section
                    v-if="
                        !updateInProgress &&
                        !isCurrentVersionHigherThanRelease &&
                        (changeLogDialog.loading || changeLogDialog.loaded)
                    "
                    data-testid="inline-change-log"
                    class="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-xs">
                    <div
                        class="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/40 px-4 py-3">
                        <span class="flex min-w-0 items-center gap-2">
                            <FileText class="size-4 shrink-0 text-muted-foreground" />
                            <span class="truncate text-sm font-medium text-foreground">
                                {{ t('dialog.change_log.header') }}
                            </span>
                        </span>
                        <span class="max-w-[45%] truncate text-xs text-muted-foreground">
                            {{ changeLogDialog.buildName || VRCXUpdateDialog.release || appVersion }}
                        </span>
                    </div>
                    <div
                        v-if="changeLogDialog.loading"
                        class="flex min-h-32 items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                        <Loader2 class="size-4 animate-spin text-primary" />
                        <span>{{ t('dialog.change_log.loading') }}</span>
                    </div>
                    <div v-else class="max-h-64 overflow-y-auto px-4 py-3">
                        <VueShowdown
                            class="changelog-markdown"
                            :markdown="changeLogDialog.changeLog"
                            flavor="github"
                            :options="showdownOptions"
                            @click="handleLinkClick" />
                    </div>
                </section>
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
    import { computed, defineAsyncComponent } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import {
        CircleCheck,
        CloudDownload,
        ExternalLink,
        FileText,
        Info,
        Loader2,
        PackageCheck,
        X
    } from 'lucide-vue-next';

    import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Progress } from '@/components/ui/progress';
    import { openExternalLink } from '@/shared/utils';
    import { compareVersionNumbers, normalizeVersion } from '@/shared/utils/version';
    import { useVRCXUpdaterStore } from '../../stores';

    const VRCXUpdaterStore = useVRCXUpdaterStore();
    const VueShowdown = defineAsyncComponent(() => import('vue-showdown').then((module) => module.VueShowdown));

    const {
        appVersion,
        changeLogDialog,
        checkingForVRCXUpdate,
        VRCXUpdateDialog,
        pendingVRCXInstall,
        updateInProgress,
        updateProgress
    } = storeToRefs(VRCXUpdaterStore);
    const { installVRCXUpdate, restartVRCX, updateProgressText, cancelUpdate } = VRCXUpdaterStore;

    const { t } = useI18n();

    const showdownOptions = {
        emoji: true,
        openLinksInNewWindow: false,
        simplifiedAutoLink: true,
        excludeTrailingPunctuationFromURLs: true,
        literalMidWordUnderscores: true,
        tables: true,
        tablesHeaderId: false,
        ghCodeBlocks: true,
        tasklists: true
    };

    const versionComparison = computed(() => compareVersionNumbers(appVersion.value, VRCXUpdateDialog.value.release));
    const isCurrentVersionHigherThanRelease = computed(() => versionComparison.value > 0);

    const isUpToDate = computed(() => {
        if (versionComparison.value !== null) {
            return versionComparison.value === 0;
        }
        return normalizeVersion(VRCXUpdateDialog.value.release) === normalizeVersion(appVersion.value);
    });

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

        if (isCurrentVersionHigherThanRelease.value) {
            return {
                icon: Info,
                iconClass: 'text-amber-600 dark:text-amber-400',
                tone: 'bg-amber-500/10',
                borderColor: 'border-amber-500/20',
                title: `${t('dialog.vrcx_updater.current_version')} · ${appVersion.value}`,
                description: t('dialog.vrcx_updater.unpublished_version')
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
        () =>
            !isUpToDate.value &&
            !isCurrentVersionHigherThanRelease.value &&
            VRCXUpdateDialog.value.release !== pendingVRCXInstall.value
    );
    const showInstall = computed(
        () => !updateInProgress.value && !isCurrentVersionHigherThanRelease.value && Boolean(pendingVRCXInstall.value)
    );

    const openReleases = () => openExternalLink('https://github.com/Yusurmount/VRCX-Pro/releases');

    const handleLinkClick = (event) => {
        const target = event.target.closest('a');
        if (!target?.href) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        openExternalLink(target.href);
    };
</script>
