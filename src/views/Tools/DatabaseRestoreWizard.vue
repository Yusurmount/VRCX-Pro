<template>
    <div v-if="visible" class="restore-wizard-overlay">
        <WizardShell
            ref="shellRef"
            :current-step="step"
            :total-steps="TOTAL_STEPS"
            :icons="stepIcons"
            role="dialog"
            aria-modal="true">
            <!-- Step 1: restore mode -->
            <div v-if="step === 1" class="wiz-panel">
                <h2 class="wiz-title text-foreground">
                    {{ t('view.settings.advanced.advanced.db_import.wizard_mode_title') }}
                </h2>
                <p class="wiz-desc text-muted-foreground">
                    {{ t('view.settings.advanced.advanced.db_import.wizard_mode_desc') }}
                </p>
                <RadioGroup v-model="restoreMode" class="grid gap-2">
                    <div
                        class="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                        :class="restoreMode === 'incremental' ? 'border-primary' : ''">
                        <RadioGroupItem id="rw-mode-incremental" value="incremental" />
                        <div class="flex flex-col gap-1">
                            <Label for="rw-mode-incremental" class="text-sm font-medium cursor-pointer">
                                {{ t('view.settings.advanced.advanced.db_import.mode_incremental') }}
                            </Label>
                            <p class="text-xs text-muted-foreground">
                                {{ t('view.settings.advanced.advanced.db_import.mode_incremental_desc') }}
                            </p>
                        </div>
                    </div>
                    <div
                        class="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                        :class="restoreMode === 'full' ? 'border-primary' : ''">
                        <RadioGroupItem id="rw-mode-full" value="full" />
                        <div class="flex flex-col gap-1">
                            <Label for="rw-mode-full" class="text-sm font-medium cursor-pointer">
                                {{ t('view.settings.advanced.advanced.db_import.mode_full') }}
                            </Label>
                            <p class="text-xs text-muted-foreground">
                                {{ t('view.settings.advanced.advanced.db_import.mode_full_desc') }}
                            </p>
                        </div>
                    </div>
                </RadioGroup>
                <div class="wiz-actions">
                    <Button size="lg" @click="step = 2">
                        {{ t('view.settings.advanced.advanced.db_import.wizard_next') }}
                    </Button>
                    <Button variant="ghost" @click="requestClose">
                        {{ t('confirm.cancel_button') }}
                    </Button>
                </div>
            </div>

            <!-- Step 2: mode options -->
            <div v-else-if="step === 2" class="wiz-panel">
                <h2 class="wiz-title text-foreground">
                    {{ t('view.settings.advanced.advanced.db_import.wizard_options_title') }}
                </h2>

                <template v-if="restoreMode === 'incremental'">
                    <p class="wiz-desc text-muted-foreground">
                        {{ t('view.settings.advanced.advanced.db_import.strategy_description') }}
                    </p>
                    <div class="space-y-2">
                        <Label class="text-sm font-medium">
                            {{ t('view.settings.advanced.advanced.db_import.strategy_conflict_label') }}
                        </Label>
                        <RadioGroup v-model="conflictStrategy" class="grid gap-2">
                            <div
                                class="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                                :class="conflictStrategy === 'overwrite' ? 'border-primary' : ''">
                                <RadioGroupItem id="rw-conflict-overwrite" value="overwrite" />
                                <div class="flex flex-col gap-1">
                                    <Label for="rw-conflict-overwrite" class="text-sm font-medium cursor-pointer">
                                        {{ t('view.settings.advanced.advanced.db_import.strategy_overwrite') }}
                                    </Label>
                                    <p class="text-xs text-muted-foreground">
                                        {{ t('view.settings.advanced.advanced.db_import.strategy_overwrite_desc') }}
                                    </p>
                                </div>
                            </div>
                            <div
                                class="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                                :class="conflictStrategy === 'skip' ? 'border-primary' : ''">
                                <RadioGroupItem id="rw-conflict-skip" value="skip" />
                                <div class="flex flex-col gap-1">
                                    <Label for="rw-conflict-skip" class="text-sm font-medium cursor-pointer">
                                        {{ t('view.settings.advanced.advanced.db_import.strategy_skip_existing') }}
                                    </Label>
                                    <p class="text-xs text-muted-foreground">
                                        {{ t('view.settings.advanced.advanced.db_import.strategy_skip_existing_desc') }}
                                    </p>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>
                    <div class="space-y-2">
                        <Label class="text-sm font-medium">
                            {{ t('view.settings.advanced.advanced.db_import.strategy_new_label') }}
                        </Label>
                        <RadioGroup v-model="newDataStrategy" class="grid gap-2">
                            <div
                                class="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                                :class="newDataStrategy === 'add' ? 'border-primary' : ''">
                                <RadioGroupItem id="rw-new-add" value="add" />
                                <div class="flex flex-col gap-1">
                                    <Label for="rw-new-add" class="text-sm font-medium cursor-pointer">
                                        {{ t('view.settings.advanced.advanced.db_import.strategy_add') }}
                                    </Label>
                                    <p class="text-xs text-muted-foreground">
                                        {{ t('view.settings.advanced.advanced.db_import.strategy_add_desc') }}
                                    </p>
                                </div>
                            </div>
                            <div
                                class="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                                :class="newDataStrategy === 'skip' ? 'border-primary' : ''">
                                <RadioGroupItem id="rw-new-skip" value="skip" />
                                <div class="flex flex-col gap-1">
                                    <Label for="rw-new-skip" class="text-sm font-medium cursor-pointer">
                                        {{ t('view.settings.advanced.advanced.db_import.strategy_skip_new') }}
                                    </Label>
                                    <p class="text-xs text-muted-foreground">
                                        {{ t('view.settings.advanced.advanced.db_import.strategy_skip_new_desc') }}
                                    </p>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>
                </template>

                <Alert v-else variant="warning">
                    <TriangleAlert class="h-4 w-4" />
                    <AlertDescription class="text-sm">
                        {{ t('view.settings.advanced.advanced.db_import.confirm_full_warning') }}
                    </AlertDescription>
                </Alert>

                <div class="flex items-center justify-between rounded-md border p-3">
                    <div class="flex flex-col gap-1">
                        <Label for="rw-allow-mismatch" class="text-sm font-medium cursor-pointer">
                            {{ t('view.settings.advanced.advanced.db_import.strategy_allow_user_mismatch') }}
                        </Label>
                        <p class="text-xs text-muted-foreground">
                            {{ t('view.settings.advanced.advanced.db_import.strategy_allow_user_mismatch_desc') }}
                        </p>
                    </div>
                    <Switch id="rw-allow-mismatch" v-model="allowUserMismatch" />
                </div>

                <div class="wiz-actions">
                    <Button size="lg" @click="step = 3">
                        {{ t('view.settings.advanced.advanced.db_import.wizard_next') }}
                    </Button>
                    <Button variant="ghost" @click="step = 1">{{ t('common.actions.back') }}</Button>
                    <Button variant="ghost" @click="requestClose">{{ t('confirm.cancel_button') }}</Button>
                </div>
            </div>

            <!-- Step 3: backup file -->
            <div v-else-if="step === 3" class="wiz-panel">
                <h2 class="wiz-title text-foreground">
                    {{ t('view.settings.advanced.advanced.db_import.wizard_file_title') }}
                </h2>

                <div v-if="importFileSummary" class="rounded-md border p-3 space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-muted-foreground">
                            {{ t('view.settings.advanced.advanced.db_import.summary_tables') }}
                        </span>
                        <span class="font-medium">{{ importFileSummary.tableCount }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-muted-foreground">
                            {{ t('view.settings.advanced.advanced.db_import.summary_records') }}
                        </span>
                        <span class="font-medium">{{ importFileSummary.totalRecords }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-muted-foreground">
                            {{ t('view.settings.advanced.advanced.db_import.mode_label') }}
                        </span>
                        <span class="font-medium">
                            {{
                                restoreMode === 'full'
                                    ? t('view.settings.advanced.advanced.db_import.mode_full')
                                    : t('view.settings.advanced.advanced.db_import.mode_incremental')
                            }}
                        </span>
                    </div>
                </div>

                <Alert v-if="importDiagnostics?.userMismatch" variant="warning">
                    <TriangleAlert class="h-4 w-4" />
                    <AlertDescription class="text-sm">
                        {{ t('view.settings.advanced.advanced.db_import.confirm_user_mismatch_notice') }}
                    </AlertDescription>
                </Alert>

                <Alert v-if="fileError" variant="destructive">
                    <AlertDescription class="text-sm">
                        {{ t('view.settings.advanced.advanced.db_import.error', { error: fileError }) }}
                    </AlertDescription>
                </Alert>
                <Alert v-if="fileErrorCode === 'user_mismatch'" variant="warning">
                    <TriangleAlert class="h-4 w-4" />
                    <AlertDescription class="text-sm">
                        {{ t('view.settings.advanced.advanced.db_import.error_user_mismatch_hint') }}
                    </AlertDescription>
                </Alert>

                <div class="wiz-actions">
                    <Button size="lg" :disabled="!importDataCache || reading" @click="handleStart">
                        <Upload class="h-4 w-4 mr-1" />
                        {{ t('view.settings.advanced.advanced.db_import.button') }}
                    </Button>
                    <Button variant="outline" :disabled="reading" @click="handleSelectFile">
                        <Loader2 v-if="reading" class="h-4 w-4 animate-spin mr-1" />
                        {{ t('view.settings.advanced.advanced.db_import.select_file') }}
                    </Button>
                    <Button variant="ghost" @click="step = 2">{{ t('common.actions.back') }}</Button>
                    <Button variant="ghost" @click="requestClose">{{ t('confirm.cancel_button') }}</Button>
                </div>
            </div>

            <!-- Step 4: restore progress -->
            <div v-else-if="step === 4" class="wiz-panel">
                <h2 class="wiz-title text-foreground">
                    {{ t('view.settings.advanced.advanced.db_import.progress_title') }}
                </h2>
                <template v-if="!importError">
                    <p class="wiz-desc text-muted-foreground">{{ importProgressText }}</p>
                    <div class="w-full bg-secondary rounded-full h-2">
                        <div
                            class="bg-primary h-2 rounded-full transition-all"
                            :style="{ width: importProgressPercent + '%' }"></div>
                    </div>
                </template>
                <template v-else>
                    <Alert variant="destructive">
                        <AlertDescription class="text-sm">
                            {{ t('view.settings.advanced.advanced.db_import.error', { error: importError }) }}
                        </AlertDescription>
                    </Alert>
                    <div class="wiz-actions">
                        <Button @click="backToOptions">{{ t('common.actions.back') }}</Button>
                        <Button variant="ghost" @click="requestClose">{{ t('confirm.cancel_button') }}</Button>
                    </div>
                </template>
            </div>

            <!-- Step 5: done, restart required -->
            <div v-else class="wiz-panel">
                <h2 class="wiz-title text-foreground">
                    {{ t('view.settings.advanced.advanced.db_import.wizard_done_title') }}
                </h2>
                <p class="wiz-desc text-muted-foreground">
                    {{ t('view.settings.advanced.advanced.db_import.wizard_done_desc') }}
                </p>
                <div class="rounded-md border p-3 space-y-2 text-sm">
                    <div class="flex justify-between text-green-600 dark:text-green-400">
                        <span>{{ t('view.settings.advanced.advanced.db_import.report_overwritten') }}</span>
                        <span class="font-medium">{{ report.overwritten }}</span>
                    </div>
                    <div class="flex justify-between text-blue-600 dark:text-blue-400">
                        <span>{{ t('view.settings.advanced.advanced.db_import.report_added') }}</span>
                        <span class="font-medium">{{ report.added }}</span>
                    </div>
                    <div class="border-t pt-2 flex justify-between font-medium">
                        <span>{{ t('view.settings.advanced.advanced.db_import.report_total') }}</span>
                        <span class="font-medium">{{ report.totalProcessed }}</span>
                    </div>
                </div>
                <Alert v-if="report.skippedTables.length > 0" variant="warning">
                    <TriangleAlert class="h-4 w-4" />
                    <AlertDescription class="text-sm space-y-1">
                        <p>{{ t('view.settings.advanced.advanced.db_import.report_skipped_tables') }}</p>
                        <ul class="list-disc pl-4">
                            <li v-for="name in report.skippedTables" :key="name" class="break-all">
                                {{ name }}
                            </li>
                        </ul>
                    </AlertDescription>
                </Alert>
                <div class="wiz-actions">
                    <Button size="lg" @click="handleRestart">
                        <RefreshCw class="h-4 w-4 mr-1" />
                        {{ t('confirm.restart_now') }}
                    </Button>
                    <Button variant="ghost" @click="requestClose">
                        {{ t('confirm.restart_later') }}
                    </Button>
                </div>
            </div>
        </WizardShell>
    </div>
</template>

<script setup>
    import { computed, markRaw, nextTick, reactive, ref, shallowRef, watch } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { toast } from 'vue-sonner';
    import {
        CircleCheck,
        FileUp,
        ListChecks,
        Loader2,
        RefreshCw,
        SlidersHorizontal,
        TriangleAlert,
        Upload
    } from 'lucide-vue-next';

    import { Button } from '@/components/ui/button';
    import { Switch } from '@/components/ui/switch';
    import { Label } from '@/components/ui/label';
    import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
    import { Alert, AlertDescription } from '@/components/ui/alert';
    import WizardShell from '@/components/wizard/WizardShell.vue';

    import { useFeedStore, useUserStore, useVRCXUpdaterStore } from '@/stores';
    import { executeImport, readImportFile } from '@/services/database/exportImport';
    import {
        getLocalAvatarFavorites,
        getLocalFriendFavorites,
        getLocalWorldFavorites
    } from '@/coordinators/favoriteCoordinator';

    const TOTAL_STEPS = 5;

    const props = defineProps({
        visible: { type: Boolean, default: false }
    });

    const emit = defineEmits(['close']);

    const { t } = useI18n();
    const userStore = useUserStore();
    const vrcxUpdaterStore = useVRCXUpdaterStore();

    const step = ref(1);
    const restoreMode = ref('incremental');
    const conflictStrategy = ref('overwrite');
    const newDataStrategy = ref('add');
    const allowUserMismatch = ref(false);

    const reading = ref(false);
    const importing = ref(false);
    const importProgressPercent = ref(0);
    // 'clearing' | 'importing' — which step the progress bar is showing
    const importProgressPhase = ref('importing');

    const importDataCache = shallowRef(null);
    const importFileSummary = ref(null);
    const importDiagnostics = ref(null);
    const fileError = ref('');
    const fileErrorCode = ref('');
    const importError = ref('');

    const report = reactive({
        overwritten: 0,
        added: 0,
        totalProcessed: 0,
        skippedTables: []
    });

    const stepIcons = {
        1: markRaw(SlidersHorizontal),
        2: markRaw(ListChecks),
        3: markRaw(FileUp),
        4: markRaw(RefreshCw),
        5: markRaw(CircleCheck)
    };
    const shellRef = ref(null);

    const importProgressText = computed(() => {
        const progress = Math.round(importProgressPercent.value);
        return importProgressPhase.value === 'clearing'
            ? t('view.settings.advanced.advanced.db_import.clearing', { progress })
            : t('view.settings.advanced.advanced.db_import.importing', { progress });
    });

    watch(
        () => props.visible,
        (open) => {
            if (open) {
                resetWizard();
                nextTick(() => shellRef.value?.playOpenAnimation());
            }
        }
    );

    // The loaded file was validated with the previous flag — drop it so the
    // user re-selects the file under the new allow-user-mismatch setting.
    watch(allowUserMismatch, () => {
        if (!importDataCache.value) return;
        importDataCache.value = null;
        importFileSummary.value = null;
        importDiagnostics.value = null;
        fileError.value = '';
        fileErrorCode.value = '';
    });

    function resetWizard() {
        step.value = 1;
        restoreMode.value = 'incremental';
        conflictStrategy.value = 'overwrite';
        newDataStrategy.value = 'add';
        allowUserMismatch.value = false;
        reading.value = false;
        importing.value = false;
        importProgressPercent.value = 0;
        importProgressPhase.value = 'importing';
        importDataCache.value = null;
        importFileSummary.value = null;
        importDiagnostics.value = null;
        fileError.value = '';
        fileErrorCode.value = '';
        importError.value = '';
        report.overwritten = 0;
        report.added = 0;
        report.totalProcessed = 0;
        report.skippedTables = [];
    }

    const closing = ref(false);

    async function requestClose() {
        // No leaving mid-restore: the import cannot be cancelled.
        if (closing.value || (step.value === 4 && !importError.value)) return;
        closing.value = true;
        await shellRef.value?.playCloseAnimation();
        emit('close');
        closing.value = false;
    }

    function backToOptions() {
        importError.value = '';
        step.value = 3;
    }

    async function handleSelectFile() {
        if (reading.value) return;
        reading.value = true;
        fileError.value = '';
        fileErrorCode.value = '';

        try {
            const result = await readImportFile(userStore.currentUser?.id || '', {
                allowUserMismatch: allowUserMismatch.value
            });
            if (result.success) {
                importDataCache.value = result.data;
                importFileSummary.value = result.summary;
                importDiagnostics.value = result.diagnostics ?? null;
            } else if (result.error !== 'cancelled') {
                fileError.value = result.error;
                fileErrorCode.value = result.errorCode ?? '';
                toast.error(t('view.settings.advanced.advanced.db_import.error', { error: result.error }));
            }
        } catch (e) {
            console.error('[RestoreWizard] readImportFile threw:', e);
            fileError.value = e.message || String(e);
            fileErrorCode.value = '';
            toast.error(t('view.settings.advanced.advanced.db_import.error', { error: fileError.value }));
        } finally {
            reading.value = false;
        }
    }

    async function handleStart() {
        if (!importDataCache.value || importing.value) return;

        step.value = 4;
        importError.value = '';
        importProgressPercent.value = 0;
        importProgressPhase.value = 'importing';
        importing.value = true;

        const result = await executeImport(
            importDataCache.value,
            {
                conflictStrategy: conflictStrategy.value,
                newDataStrategy: newDataStrategy.value,
                mode: restoreMode.value
            },
            (state) => {
                if (state.phase === 'importing' || state.phase === 'clearing') {
                    importProgressPhase.value = state.phase;
                    importProgressPercent.value = state.progress * 100;
                }
            }
        );

        importing.value = false;

        if (result.success) {
            report.overwritten = result.report.overwritten;
            report.added = result.report.added;
            report.totalProcessed = result.report.totalProcessed;
            report.skippedTables = result.report.skippedTables ?? [];
            getLocalWorldFavorites();
            getLocalAvatarFavorites();
            getLocalFriendFavorites();
            useFeedStore().feedTableLookup();
            toast.success(
                t('view.settings.advanced.advanced.db_import.success', {
                    importedCount: result.report.overwritten + result.report.added,
                    tablesProcessed: result.tablesProcessed
                })
            );
            step.value = 5;
        } else {
            importError.value = result.error || String(result);
            toast.error(t('view.settings.advanced.advanced.db_import.error', { error: importError.value }));
        }
    }

    function handleRestart() {
        vrcxUpdaterStore.restartVRCX(false);
    }
</script>

<style scoped>
    .restore-wizard-overlay {
        position: fixed;
        inset: 0;
        z-index: 60;
    }
</style>
