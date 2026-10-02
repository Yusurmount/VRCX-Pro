<template>
    <div v-if="visible" class="restore-wizard bg-background" role="dialog" aria-modal="true">
        <header class="rw-header">
            <span class="rw-step-counter text-muted-foreground">
                {{ t('view.settings.advanced.advanced.db_import.wizard_step', { current: step, total: TOTAL_STEPS }) }}
            </span>
        </header>
        <div
            class="rw-progress"
            role="progressbar"
            :aria-valuenow="step"
            aria-valuemin="1"
            :aria-valuemax="TOTAL_STEPS">
            <div
                v-for="s in TOTAL_STEPS"
                :key="s"
                class="rw-progress-segment"
                :class="{ active: s <= step }" />
        </div>

        <div class="rw-body">
            <aside class="rw-left">
                <Transition name="rw-fade" mode="out-in">
                    <component :is="stepIcon" :key="step" class="rw-icon text-foreground" :stroke-width="1.5" />
                </Transition>
            </aside>

            <section class="rw-right">
                <Transition name="rw-fade" mode="out-in">
                    <!-- Step 1: restore mode -->
                    <div v-if="step === 1" key="mode" class="rw-panel">
                        <h2 class="rw-title text-foreground">
                            {{ t('view.settings.advanced.advanced.db_import.wizard_mode_title') }}
                        </h2>
                        <p class="rw-desc text-muted-foreground">
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
                                        {{
                                            t('view.settings.advanced.advanced.db_import.mode_incremental_desc')
                                        }}
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
                        <div class="rw-actions">
                            <Button size="lg" @click="step = 2">
                                {{ t('view.settings.advanced.advanced.db_import.wizard_next') }}
                            </Button>
                            <Button variant="ghost" @click="requestClose">
                                {{ t('confirm.cancel_button') }}
                            </Button>
                        </div>
                    </div>

                    <!-- Step 2: mode options + backup file -->
                    <div v-else-if="step === 2" key="options" class="rw-panel">
                        <h2 class="rw-title text-foreground">
                            {{ t('view.settings.advanced.advanced.db_import.wizard_options_title') }}
                        </h2>

                        <template v-if="restoreMode === 'incremental'">
                            <p class="rw-desc text-muted-foreground">
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
                                            <Label
                                                for="rw-conflict-overwrite"
                                                class="text-sm font-medium cursor-pointer">
                                                {{ t('view.settings.advanced.advanced.db_import.strategy_overwrite') }}
                                            </Label>
                                            <p class="text-xs text-muted-foreground">
                                                {{
                                                    t(
                                                        'view.settings.advanced.advanced.db_import.strategy_overwrite_desc'
                                                    )
                                                }}
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        class="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                                        :class="conflictStrategy === 'skip' ? 'border-primary' : ''">
                                        <RadioGroupItem id="rw-conflict-skip" value="skip" />
                                        <div class="flex flex-col gap-1">
                                            <Label for="rw-conflict-skip" class="text-sm font-medium cursor-pointer">
                                                {{
                                                    t(
                                                        'view.settings.advanced.advanced.db_import.strategy_skip_existing'
                                                    )
                                                }}
                                            </Label>
                                            <p class="text-xs text-muted-foreground">
                                                {{
                                                    t(
                                                        'view.settings.advanced.advanced.db_import.strategy_skip_existing_desc'
                                                    )
                                                }}
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
                                                {{
                                                    t('view.settings.advanced.advanced.db_import.strategy_add_desc')
                                                }}
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        class="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                                        :class="newDataStrategy === 'skip' ? 'border-primary' : ''">
                                        <RadioGroupItem id="rw-new-skip" value="skip" />
                                        <div class="flex flex-col gap-1">
                                            <Label for="rw-new-skip" class="text-sm font-medium cursor-pointer">
                                                {{
                                                    t(
                                                        'view.settings.advanced.advanced.db_import.strategy_skip_new'
                                                    )
                                                }}
                                            </Label>
                                            <p class="text-xs text-muted-foreground">
                                                {{
                                                    t(
                                                        'view.settings.advanced.advanced.db_import.strategy_skip_new_desc'
                                                    )
                                                }}
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

                        <div class="rw-actions">
                            <Button size="lg" :disabled="!importDataCache || reading" @click="handleStart">
                                <Upload class="h-4 w-4 mr-1" />
                                {{ t('view.settings.advanced.advanced.db_import.button') }}
                            </Button>
                            <Button variant="outline" :disabled="reading" @click="handleSelectFile">
                                <Loader2 v-if="reading" class="h-4 w-4 animate-spin mr-1" />
                                {{ t('view.settings.advanced.advanced.db_import.select_file') }}
                            </Button>
                            <Button variant="ghost" @click="step = 1">{{ t('common.actions.back') }}</Button>
                            <Button variant="ghost" @click="requestClose">{{ t('confirm.cancel_button') }}</Button>
                        </div>
                    </div>

                    <!-- Step 3: restore progress -->
                    <div v-else-if="step === 3" key="progress" class="rw-panel">
                        <h2 class="rw-title text-foreground">
                            {{ t('view.settings.advanced.advanced.db_import.progress_title') }}
                        </h2>
                        <template v-if="!importError">
                            <p class="rw-desc text-muted-foreground">{{ importProgressText }}</p>
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
                            <div class="rw-actions">
                                <Button @click="backToOptions">{{ t('common.actions.back') }}</Button>
                                <Button variant="ghost" @click="requestClose">{{ t('confirm.cancel_button') }}</Button>
                            </div>
                        </template>
                    </div>

                    <!-- Step 4: done, restart required -->
                    <div v-else key="done" class="rw-panel">
                        <h2 class="rw-title text-foreground">
                            {{ t('view.settings.advanced.advanced.db_import.wizard_done_title') }}
                        </h2>
                        <p class="rw-desc text-muted-foreground">
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
                        <div class="rw-actions">
                            <Button size="lg" @click="handleRestart">
                                <RefreshCw class="h-4 w-4 mr-1" />
                                {{ t('confirm.restart_now') }}
                            </Button>
                            <Button variant="ghost" @click="requestClose">
                                {{ t('confirm.restart_later') }}
                            </Button>
                        </div>
                    </div>
                </Transition>
            </section>
        </div>
    </div>
</template>

<script setup>
    import { computed, reactive, ref, shallowRef, watch } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { toast } from 'vue-sonner';
    import { CircleCheck, FileUp, Loader2, RefreshCw, SlidersHorizontal, TriangleAlert, Upload } from 'lucide-vue-next';

    import { Button } from '@/components/ui/button';
    import { Switch } from '@/components/ui/switch';
    import { Label } from '@/components/ui/label';
    import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
    import { Alert, AlertDescription } from '@/components/ui/alert';

    import { useFeedStore, useUserStore, useVRCXUpdaterStore } from '@/stores';
    import { executeImport, readImportFile } from '@/services/database/exportImport';
    import {
        getLocalAvatarFavorites,
        getLocalFriendFavorites,
        getLocalWorldFavorites
    } from '@/coordinators/favoriteCoordinator';

    const TOTAL_STEPS = 4;

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
        1: SlidersHorizontal,
        2: FileUp,
        3: RefreshCw,
        4: CircleCheck
    };
    const stepIcon = computed(() => stepIcons[step.value]);

    const importProgressText = computed(() => {
        const progress = Math.round(importProgressPercent.value);
        return importProgressPhase.value === 'clearing'
            ? t('view.settings.advanced.advanced.db_import.clearing', { progress })
            : t('view.settings.advanced.advanced.db_import.importing', { progress });
    });

    watch(
        () => props.visible,
        (open) => {
            if (open) resetWizard();
        }
    );

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

    function requestClose() {
        // No leaving mid-restore: the import cannot be cancelled.
        if (step.value === 3 && !importError.value) return;
        emit('close');
    }

    function backToOptions() {
        importError.value = '';
        step.value = 2;
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
                toast.error(
                    t('view.settings.advanced.advanced.db_import.error', { error: result.error })
                );
            }
        } catch (e) {
            console.error('[RestoreWizard] readImportFile threw:', e);
            fileError.value = e.message || String(e);
            fileErrorCode.value = '';
            toast.error(
                t('view.settings.advanced.advanced.db_import.error', { error: fileError.value })
            );
        } finally {
            reading.value = false;
        }
    }

    async function handleStart() {
        if (!importDataCache.value || importing.value) return;

        step.value = 3;
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
            step.value = 4;
        } else {
            importError.value = result.error || String(result);
            toast.error(
                t('view.settings.advanced.advanced.db_import.error', { error: importError.value })
            );
        }
    }

    function handleRestart() {
        vrcxUpdaterStore.restartVRCX(false);
    }
</script>

<style scoped>
    .restore-wizard {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 96px;
        padding: 40px;
        overflow: hidden;
        background-color: var(--background);
    }

    /* ---- Top bar ---- */
    .rw-header {
        position: absolute;
        top: 24px;
        left: 36px;
        right: 36px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
    }

    .rw-step-counter {
        font-size: 13px;
        font-weight: 500;
    }

    .rw-progress {
        position: absolute;
        top: 78px;
        left: 36px;
        right: 36px;
        display: flex;
        gap: 6px;
    }

    .rw-progress-segment {
        flex: 1;
        height: 4px;
        border-radius: 999px;
        background-color: var(--muted-foreground);
        opacity: 0.2;
        transition:
            opacity 0.3s ease,
            background-color 0.3s ease;
    }

    .rw-progress-segment.active {
        opacity: 1;
        background-color: var(--primary);
    }

    /* ---- Body ---- */
    .rw-body {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 96px;
        width: 100%;
        height: 100%;
    }

    .rw-left {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 140px;
        height: 140px;
        flex: none;
    }

    .rw-icon {
        width: 140px;
        height: 140px;
    }

    .rw-right {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .rw-panel {
        width: 440px;
        max-width: 440px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .rw-title {
        margin: 0;
        font-size: 26px;
        font-weight: 800;
        letter-spacing: -0.02em;
    }

    .rw-desc {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
    }

    .rw-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .rw-actions > * {
        width: 100%;
    }

    /* ---- Step transitions ---- */
    .rw-fade-enter-active,
    .rw-fade-leave-active {
        transition:
            opacity 0.18s ease,
            transform 0.18s ease;
    }

    .rw-fade-enter-from {
        opacity: 0;
        transform: translateX(12px);
    }

    .rw-fade-leave-to {
        opacity: 0;
        transform: translateX(-12px);
    }

    /* ---- Responsive: keep the layout usable in smaller windows ---- */
    @media (max-width: 900px) {
        .restore-wizard,
        .rw-body {
            gap: 48px;
        }

        .restore-wizard {
            padding: 40px 24px;
        }

        .rw-left,
        .rw-icon {
            width: 100px;
            height: 100px;
        }

        .rw-panel {
            width: min(440px, calc(100vw - 200px));
        }
    }

    @media (max-width: 640px) {
        .rw-left {
            display: none;
        }
    }
</style>
