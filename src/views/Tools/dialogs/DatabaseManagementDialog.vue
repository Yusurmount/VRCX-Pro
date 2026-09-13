<template>
    <!-- Operation Selection Dialog -->
    <Dialog
        :open="visible"
        @update:open="
            (open) => {
                if (!open) close();
            }
        ">
        <DialogContent class="x-dialog sm:max-w-sm">
            <DialogHeader>
                <DialogTitle>{{ t('view.settings.advanced.advanced.db_manage.title') }}</DialogTitle>
            </DialogHeader>
            <div class="flex flex-col gap-2 py-2">
                <Button
                    variant="outline"
                    class="justify-start"
                    :disabled="exportInProgress"
                    @click="handleDbManagementSelect('export')">
                    <Download class="h-4 w-4 mr-2" />
                    {{ t('view.settings.advanced.advanced.db_export.button') }}
                </Button>
                <Button
                    variant="outline"
                    class="justify-start"
                    :disabled="importInProgress"
                    @click="handleDbManagementSelect('import')">
                    <Upload class="h-4 w-4 mr-2" />
                    {{ t('view.settings.advanced.advanced.db_import.button') }}
                </Button>
                <Button
                    variant="destructive"
                    class="justify-start"
                    :disabled="resetInProgress"
                    @click="handleDbManagementSelect('reset')">
                    <Trash2 class="h-4 w-4 mr-2" />
                    {{ t('view.settings.advanced.advanced.db_reset.button') }}
                </Button>
            </div>
        </DialogContent>
    </Dialog>

    <!-- Export Progress Dialog -->
    <Dialog
        :open="isExportDialogVisible"
        @update:open="
            (open) => {
                if (!open) isExportDialogVisible = false;
            }
        ">
        <DialogContent class="x-dialog sm:max-w-md" :show-close-button="false">
            <DialogHeader>
                <DialogTitle>{{ t('view.settings.advanced.advanced.db_export.confirm_title') }}</DialogTitle>
            </DialogHeader>
            <div class="flex flex-col gap-4 py-2">
                <template v-if="exportPhase === 'confirm'">
                    <Alert variant="warning" class="mb-2">
                        <TriangleAlert class="h-4 w-4" />
                        <AlertDescription>
                            {{ t('view.settings.advanced.advanced.db_export.confirm_not_encrypted') }}
                        </AlertDescription>
                    </Alert>
                    <p class="text-sm text-muted-foreground">
                        {{ t('view.settings.advanced.advanced.db_export.confirm_message') }}
                    </p>
                </template>
                <template v-else-if="exportPhase === 'in_progress'">
                    <p class="text-sm">
                        {{
                            t('view.settings.advanced.advanced.db_export.exporting', {
                                current: exportProgress.current,
                                total: exportProgress.total
                            })
                        }}
                    </p>
                    <div class="w-full bg-secondary rounded-full h-2">
                        <div
                            class="bg-primary h-2 rounded-full transition-all"
                            :style="{ width: exportProgress.percent + '%' }"></div>
                    </div>
                </template>
                <template v-else-if="exportPhase === 'done'">
                    <Alert variant="default" class="mb-2 border-green-500/50">
                        <AlertDescription>
                            {{ t('view.settings.advanced.advanced.db_export.success', { path: exportResult }) }}
                        </AlertDescription>
                    </Alert>
                </template>
                <template v-else-if="exportPhase === 'error'">
                    <Alert variant="destructive" class="mb-2">
                        <AlertDescription>
                            {{ t('view.settings.advanced.advanced.db_export.error', { error: exportError }) }}
                        </AlertDescription>
                    </Alert>
                </template>
            </div>
            <DialogFooter>
                <template v-if="exportPhase === 'confirm'">
                    <Button variant="outline" size="sm" @click="isExportDialogVisible = false">
                        {{ t('confirm.cancel_button') }}
                    </Button>
                    <Button size="sm" @click="handleExport">
                        <Download class="h-4 w-4 mr-1" />
                        {{ t('view.settings.advanced.advanced.db_export.button') }}
                    </Button>
                </template>
                <template v-else-if="exportPhase === 'in_progress'">
                    <Button variant="outline" size="sm" disabled>
                        {{
                            t('view.settings.advanced.advanced.db_export.exporting', {
                                current: exportProgress.current,
                                total: exportProgress.total
                            })
                        }}
                    </Button>
                </template>
                <template v-else>
                    <Button variant="outline" size="sm" @click="isExportDialogVisible = false">
                        {{ t('confirm.cancel_button') }}
                    </Button>
                </template>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <!-- Import Dialog -->
    <Dialog
        :open="isImportDialogVisible"
        @update:open="
            (open) => {
                if (!open) isImportDialogVisible = false;
            }
        ">
        <DialogContent class="x-dialog sm:max-w-lg" :show-close-button="false">
            <DialogHeader>
                <DialogTitle>
                    <template v-if="importPhase === 'strategy'">
                        {{ t('view.settings.advanced.advanced.db_import.strategy_title') }}
                    </template>
                    <template v-else-if="importPhase === 'confirm'">
                        {{ t('view.settings.advanced.advanced.db_import.confirm_title') }}
                    </template>
                    <template v-else-if="importPhase === 'reading' || importPhase === 'importing'">
                        {{ t('view.settings.advanced.advanced.db_import.progress_title') }}
                    </template>
                    <template v-else-if="importPhase === 'report'">
                        {{ t('view.settings.advanced.advanced.db_import.report_title') }}
                    </template>
                    <template v-else>
                        {{ t('view.settings.advanced.advanced.db_import.confirm_title') }}
                    </template>
                </DialogTitle>
            </DialogHeader>

            <div class="flex flex-col gap-4 py-2">
                <!-- Strategy Selection Phase -->
                <template v-if="importPhase === 'strategy'">
                    <p class="text-sm text-muted-foreground">
                        {{ t('view.settings.advanced.advanced.db_import.strategy_description') }}
                    </p>

                    <div class="space-y-4">
                        <!-- Existing data strategy -->
                        <div class="space-y-2">
                            <Label class="text-sm font-medium">
                                {{ t('view.settings.advanced.advanced.db_import.strategy_conflict_label') }}
                            </Label>
                            <RadioGroup v-model="conflictStrategy" class="grid gap-2">
                                <div
                                    class="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                                    :class="conflictStrategy === 'overwrite' ? 'border-primary' : ''">
                                    <RadioGroupItem id="conflict-overwrite" value="overwrite" />
                                    <div class="flex flex-col gap-1">
                                        <Label for="conflict-overwrite" class="text-sm font-medium cursor-pointer">
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
                                    <RadioGroupItem id="conflict-skip" value="skip" />
                                    <div class="flex flex-col gap-1">
                                        <Label for="conflict-skip" class="text-sm font-medium cursor-pointer">
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

                        <!-- New data strategy -->
                        <div class="space-y-2">
                            <Label class="text-sm font-medium">
                                {{ t('view.settings.advanced.advanced.db_import.strategy_new_label') }}
                            </Label>
                            <RadioGroup v-model="newDataStrategy" class="grid gap-2">
                                <div
                                    class="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                                    :class="newDataStrategy === 'add' ? 'border-primary' : ''">
                                    <RadioGroupItem id="new-add" value="add" />
                                    <div class="flex flex-col gap-1">
                                        <Label for="new-add" class="text-sm font-medium cursor-pointer">
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
                                    <RadioGroupItem id="new-skip" value="skip" />
                                    <div class="flex flex-col gap-1">
                                        <Label for="new-skip" class="text-sm font-medium cursor-pointer">
                                            {{ t('view.settings.advanced.advanced.db_import.strategy_skip_new') }}
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

                        <!-- Compatibility options -->
                        <div class="space-y-2">
                            <Label class="text-sm font-medium">
                                {{ t('view.settings.advanced.advanced.db_import.strategy_compat_label') }}
                            </Label>
                            <div class="flex items-center justify-between rounded-md border p-3">
                                <div class="flex flex-col gap-1">
                                    <Label for="compat-user-mismatch" class="text-sm font-medium cursor-pointer">
                                        {{
                                            t(
                                                'view.settings.advanced.advanced.db_import.strategy_allow_user_mismatch'
                                            )
                                        }}
                                    </Label>
                                    <p class="text-xs text-muted-foreground">
                                        {{
                                            t(
                                                'view.settings.advanced.advanced.db_import.strategy_allow_user_mismatch_desc'
                                            )
                                        }}
                                    </p>
                                </div>
                                <Switch id="compat-user-mismatch" v-model="allowUserMismatch" />
                            </div>
                        </div>
                    </div>
                </template>

                <!-- File Reading Phase -->
                <template v-else-if="importPhase === 'reading'">
                    <p class="text-sm">{{ t('view.settings.advanced.advanced.db_import.reading') }}</p>
                    <Spinner class="h-5 w-5 mx-auto" />
                </template>

                <!-- Confirmation Phase -->
                <template v-else-if="importPhase === 'confirm'">
                    <Alert variant="default" class="mb-2 border-blue-500/50">
                        <AlertDescription class="text-sm">
                            {{ t('view.settings.advanced.advanced.db_import.confirm_message') }}
                        </AlertDescription>
                    </Alert>

                    <Alert v-if="importDiagnostics?.userMismatch" variant="warning" class="mb-0">
                        <TriangleAlert class="h-4 w-4" />
                        <AlertDescription class="text-sm">
                            {{ t('view.settings.advanced.advanced.db_import.confirm_user_mismatch_notice') }}
                        </AlertDescription>
                    </Alert>

                    <div class="rounded-md border p-3 space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-muted-foreground">{{
                                t('view.settings.advanced.advanced.db_import.summary_tables')
                            }}</span>
                            <span class="font-medium">{{ importFileSummary?.tableCount }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-muted-foreground">{{
                                t('view.settings.advanced.advanced.db_import.summary_records')
                            }}</span>
                            <span class="font-medium">{{ importFileSummary?.totalRecords }}</span>
                        </div>
                        <div class="border-t pt-2 mt-2">
                            <div class="flex justify-between">
                                <span class="text-muted-foreground">{{
                                    t('view.settings.advanced.advanced.db_import.strategy_conflict_label')
                                }}</span>
                                <span class="font-medium">{{
                                    conflictStrategy === 'overwrite'
                                        ? t('view.settings.advanced.advanced.db_import.strategy_overwrite')
                                        : t('view.settings.advanced.advanced.db_import.strategy_skip_existing')
                                }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-muted-foreground">{{
                                    t('view.settings.advanced.advanced.db_import.strategy_new_label')
                                }}</span>
                                <span class="font-medium">{{
                                    newDataStrategy === 'add'
                                        ? t('view.settings.advanced.advanced.db_import.strategy_add')
                                        : t('view.settings.advanced.advanced.db_import.strategy_skip_new')
                                }}</span>
                            </div>
                        </div>
                    </div>
                </template>

                <!-- Importing Phase -->
                <template v-else-if="importPhase === 'importing'">
                    <p class="text-sm">
                        {{
                            t('view.settings.advanced.advanced.db_import.importing', {
                                progress: Math.round(importProgressPercent)
                            })
                        }}
                    </p>
                    <div class="w-full bg-secondary rounded-full h-2">
                        <div
                            class="bg-primary h-2 rounded-full transition-all"
                            :style="{ width: importProgressPercent + '%' }"></div>
                    </div>
                </template>

                <!-- Report Phase -->
                <template v-else-if="importPhase === 'report'">
                    <Alert variant="default" class="mb-2 border-green-500/50">
                        <AlertDescription>
                            {{
                                t('view.settings.advanced.advanced.db_import.success', {
                                    importedCount: importReport.overwritten + importReport.added,
                                    tablesProcessed: importReport.tables.length
                                })
                            }}
                        </AlertDescription>
                    </Alert>

                    <div class="rounded-md border p-3 space-y-2 text-sm">
                        <div class="flex justify-between text-green-600 dark:text-green-400">
                            <span>{{ t('view.settings.advanced.advanced.db_import.report_overwritten') }}</span>
                            <span class="font-medium">{{ importReport.overwritten }}</span>
                        </div>
                        <div class="flex justify-between text-blue-600 dark:text-blue-400">
                            <span>{{ t('view.settings.advanced.advanced.db_import.report_added') }}</span>
                            <span class="font-medium">{{ importReport.added }}</span>
                        </div>
                        <div
                            v-if="importReport.skippedExisting > 0"
                            class="flex justify-between text-muted-foreground">
                            <span>{{
                                t('view.settings.advanced.advanced.db_import.report_skipped_existing')
                            }}</span>
                            <span class="font-medium">{{ importReport.skippedExisting }}</span>
                        </div>
                        <div v-if="importReport.skippedNew > 0" class="flex justify-between text-muted-foreground">
                            <span>{{ t('view.settings.advanced.advanced.db_import.report_skipped_new') }}</span>
                            <span class="font-medium">{{ importReport.skippedNew }}</span>
                        </div>
                        <div class="border-t pt-2 flex justify-between font-medium">
                            <span>{{ t('view.settings.advanced.advanced.db_import.report_total') }}</span>
                            <span>{{ importReport.totalProcessed }}</span>
                        </div>
                    </div>

                    <!-- Skipped tables -->
                    <Alert v-if="importReport.skippedTables?.length > 0" variant="warning" class="mb-0">
                        <TriangleAlert class="h-4 w-4" />
                        <AlertDescription class="text-sm space-y-1">
                            <p>{{ t('view.settings.advanced.advanced.db_import.report_skipped_tables') }}</p>
                            <ul class="list-disc pl-4">
                                <li v-for="name in importReport.skippedTables" :key="name" class="break-all">
                                    {{ name }}
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <!-- Per-table breakdown -->
                    <details class="text-sm">
                        <summary class="cursor-pointer text-muted-foreground hover:text-foreground">
                            {{ t('view.settings.advanced.advanced.db_import.report_details') }}
                        </summary>
                        <div class="mt-2 max-h-48 overflow-y-auto space-y-1">
                            <div
                                v-for="tab in importReport.tables"
                                :key="tab.tableName"
                                class="flex justify-between text-xs py-1 px-2 rounded hover:bg-muted">
                                <span class="truncate max-w-[180px]" :title="tab.tableName">{{
                                    tab.tableName
                                }}</span>
                                <span class="shrink-0">
                                    <span
                                        v-if="tab.overwritten > 0"
                                        class="text-green-600 dark:text-green-400 ml-1"
                                        :title="t('view.settings.advanced.advanced.db_import.report_overwritten')"
                                        >+{{ tab.overwritten }}O</span
                                    >
                                    <span
                                        v-if="tab.added > 0"
                                        class="text-blue-600 dark:text-blue-400 ml-1"
                                        :title="t('view.settings.advanced.advanced.db_import.report_added')"
                                        >+{{ tab.added }}A</span
                                    >
                                    <span
                                        v-if="tab.skippedExisting > 0"
                                        class="text-muted-foreground ml-1"
                                        :title="
                                            t('view.settings.advanced.advanced.db_import.report_skipped_existing')
                                        "
                                        >-{{ tab.skippedExisting }}SE</span
                                    >
                                    <span
                                        v-if="tab.skippedNew > 0"
                                        class="text-muted-foreground ml-1"
                                        :title="t('view.settings.advanced.advanced.db_import.report_skipped_new')"
                                        >-{{ tab.skippedNew }}SN</span
                                    >
                                </span>
                            </div>
                        </div>
                    </details>
                </template>

                <!-- Error Phase -->
                <template v-else-if="importPhase === 'error'">
                    <Alert variant="destructive" class="mb-2">
                        <AlertDescription>
                            {{ t('view.settings.advanced.advanced.db_import.error', { error: importError }) }}
                        </AlertDescription>
                    </Alert>
                    <Alert v-if="importErrorCode === 'user_mismatch'" variant="warning" class="mb-0">
                        <TriangleAlert class="h-4 w-4" />
                        <AlertDescription class="text-sm">
                            {{ t('view.settings.advanced.advanced.db_import.error_user_mismatch_hint') }}
                        </AlertDescription>
                    </Alert>
                </template>
            </div>

            <DialogFooter>
                <!-- Strategy: show Select file + Cancel -->
                <template v-if="importPhase === 'strategy'">
                    <Button variant="outline" size="sm" @click="isImportDialogVisible = false">
                        {{ t('confirm.cancel_button') }}
                    </Button>
                    <Button size="sm" @click="handleImportFileSelect">
                        <Upload class="h-4 w-4 mr-1" />
                        {{ t('view.settings.advanced.advanced.db_import.select_file') }}
                    </Button>
                </template>

                <!-- Reading: disabled -->
                <template v-else-if="importPhase === 'reading'">
                    <Button variant="outline" size="sm" disabled>
                        {{ t('view.settings.advanced.advanced.db_import.reading') }}
                    </Button>
                </template>

                <!-- Confirm: back + start import -->
                <template v-else-if="importPhase === 'confirm'">
                    <Button variant="outline" size="sm" @click="backToStrategy">
                        {{ t('common.actions.back') }}
                    </Button>
                    <Button size="sm" @click="handleImport">
                        <Upload class="h-4 w-4 mr-1" />
                        {{ t('view.settings.advanced.advanced.db_import.button') }}
                    </Button>
                </template>

                <!-- Importing: disabled -->
                <template v-else-if="importPhase === 'importing'">
                    <Button variant="outline" size="sm" disabled>
                        {{
                            t('view.settings.advanced.advanced.db_import.importing', {
                                progress: Math.round(importProgressPercent)
                            })
                        }}
                    </Button>
                </template>

                <!-- Report: close -->
                <template v-else-if="importPhase === 'report'">
                    <Button variant="outline" size="sm" @click="isImportDialogVisible = false">
                        {{ t('confirm.cancel_button') }}
                    </Button>
                </template>

                <!-- Error: back to strategy + close -->
                <template v-else-if="importPhase === 'error'">
                    <Button variant="outline" size="sm" @click="backToStrategy">
                        {{ t('common.actions.back') }}
                    </Button>
                    <Button variant="outline" size="sm" @click="isImportDialogVisible = false">
                        {{ t('confirm.cancel_button') }}
                    </Button>
                </template>

                <!-- Fallback: close -->
                <template v-else>
                    <Button variant="outline" size="sm" @click="isImportDialogVisible = false">
                        {{ t('confirm.cancel_button') }}
                    </Button>
                </template>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <!-- Reset Database Dialog -->
    <Dialog
        :open="isResetDialogVisible"
        @update:open="
            (open) => {
                if (!open) isResetDialogVisible = false;
            }
        ">
        <DialogContent class="x-dialog sm:max-w-md">
            <DialogHeader>
                <DialogTitle>
                    {{ t('view.settings.advanced.advanced.db_reset.warning_title') }}
                </DialogTitle>
            </DialogHeader>

            <template v-if="resetPhase === 'confirm'">
                <Alert variant="destructive" class="mb-3">
                    <TriangleAlert />
                    <AlertDescription>
                        {{ t('view.settings.advanced.advanced.db_reset.warning_alert') }}
                    </AlertDescription>
                </Alert>

                <div class="flex flex-col gap-2 text-sm text-muted-foreground mb-3">
                    <p>{{ t('view.settings.advanced.advanced.db_reset.warning_description') }}</p>
                    <p>{{ t('view.settings.advanced.advanced.db_reset.warning_items') }}</p>
                    <p class="font-semibold text-destructive">
                        {{ t('view.settings.advanced.advanced.db_reset.warning_confirmation') }}
                    </p>
                </div>

                <div class="space-y-2 mb-3">
                    <Label class="text-sm">
                        {{
                            t('view.settings.advanced.advanced.db_reset.input_label', {
                                required: confirmationRequiredText
                            })
                        }}
                    </Label>
                    <Input
                        v-model="resetConfirmInput"
                        :placeholder="t('view.settings.advanced.advanced.db_reset.input_placeholder')"
                        :class="resetInputError ? 'border-destructive' : ''" />
                    <p v-if="resetInputError" class="text-xs text-destructive">
                        {{ t('view.settings.advanced.advanced.db_reset.input_error') }}
                    </p>
                </div>

                <DialogFooter>
                    <Button variant="outline" size="sm" @click="isResetDialogVisible = false">
                        {{ t('confirm.cancel_button') }}
                    </Button>
                    <Button size="sm" variant="destructive" @click="handleResetDatabase">
                        <Trash2 class="h-4 w-4 mr-1" />
                        {{ t('view.settings.advanced.advanced.db_reset.button') }}
                    </Button>
                </DialogFooter>
            </template>

            <template v-else-if="resetPhase === 'in_progress'">
                <div class="flex flex-col gap-4 py-4 items-center">
                    <Spinner class="h-6 w-6" />
                    <p class="text-sm text-muted-foreground">
                        {{ t('view.settings.advanced.advanced.db_reset.in_progress') }}
                    </p>
                </div>
            </template>

            <template v-else-if="resetPhase === 'error'">
                <Alert variant="destructive" class="mb-3">
                    <TriangleAlert />
                    <AlertDescription>
                        {{ t('view.settings.advanced.advanced.db_reset.error', { error: resetError }) }}
                    </AlertDescription>
                </Alert>
                <DialogFooter>
                    <Button variant="outline" size="sm" @click="isResetDialogVisible = false">
                        {{ t('confirm.cancel_button') }}
                    </Button>
                </DialogFooter>
            </template>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { Trash2, TriangleAlert, Download, Upload } from 'lucide-vue-next';
    import { computed, reactive, ref, shallowRef } from 'vue';
    import { toast } from 'vue-sonner';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Switch } from '@/components/ui/switch';
    import { Label } from '@/components/ui/label';
    import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
    import { Alert, AlertDescription } from '@/components/ui/alert';
    import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Spinner } from '@/components/ui/spinner';
    import { useI18n } from 'vue-i18n';

    import { useFeedStore, useUserStore, useVRCXUpdaterStore } from '@/stores';
    import { exportDatabaseData, readImportFile, executeImport } from '@/services/database/exportImport';
    import {
        getLocalWorldFavorites,
        getLocalAvatarFavorites,
        getLocalFriendFavorites
    } from '@/coordinators/favoriteCoordinator';

    const props = defineProps({
        visible: { type: Boolean, default: false }
    });

    const emit = defineEmits(['close']);

    const { t } = useI18n();
    const userStore = useUserStore();
    const vrcxUpdaterStore = useVRCXUpdaterStore();

    function close() {
        emit('close');
    }

    // Operation Selection
    function handleDbManagementSelect(operation) {
        close();
        switch (operation) {
            case 'export':
                confirmExport();
                break;
            case 'import':
                confirmImport();
                break;
            case 'reset':
                isResetDialogVisible.value = true;
                break;
        }
    }

    // ── Export ──

    const isExportDialogVisible = ref(false);
    const exportPhase = ref('confirm');
    const exportInProgress = ref(false);
    const exportProgress = reactive({ current: 0, total: 1, percent: 0 });
    const exportResult = ref('');
    const exportError = ref('');

    function confirmExport() {
        exportPhase.value = 'confirm';
        exportResult.value = '';
        exportError.value = '';
        exportProgress.current = 0;
        exportProgress.total = 1;
        exportProgress.percent = 0;
        isExportDialogVisible.value = true;
    }

    async function handleExport() {
        const userId = userStore.currentUser?.id || '';
        exportPhase.value = 'in_progress';
        exportInProgress.value = true;

        const result = await exportDatabaseData(userId, (current, total) => {
            exportProgress.current = current;
            exportProgress.total = total;
            exportProgress.percent = total > 0 ? Math.round((current / total) * 100) : 0;
        });

        exportInProgress.value = false;

        if (result.success) {
            exportPhase.value = 'done';
            exportResult.value = result.path;
            toast.success(t('view.settings.advanced.advanced.db_export.success', { path: result.path }));
        } else if (result.error === 'cancelled') {
            isExportDialogVisible.value = false;
            toast(t('view.settings.advanced.advanced.db_export.error_cancelled'));
        } else {
            exportPhase.value = 'error';
            exportError.value = result.error;
            toast.error(t('view.settings.advanced.advanced.db_export.error', { error: result.error }));
        }
    }

    // ── Import ──

    const isImportDialogVisible = ref(false);
    const importPhase = ref('confirm');
    const importInProgress = ref(false);
    const importProgressPercent = ref(0);

    const conflictStrategy = ref('overwrite');
    const newDataStrategy = ref('add');
    const allowUserMismatch = ref(false);

    const importDataCache = shallowRef(null);
    const importFileSummary = ref(null);
    const importDiagnostics = ref(null);

    const importReport = reactive({
        overwritten: 0,
        added: 0,
        skippedExisting: 0,
        skippedNew: 0,
        totalProcessed: 0,
        skippedTables: [],
        tables: []
    });
    const importError = ref('');
    const importErrorCode = ref('');

    function confirmImport() {
        importPhase.value = 'strategy';
        importProgressPercent.value = 0;
        conflictStrategy.value = 'overwrite';
        newDataStrategy.value = 'add';
        allowUserMismatch.value = false;
        importDataCache.value = null;
        importFileSummary.value = null;
        importDiagnostics.value = null;
        importReport.overwritten = 0;
        importReport.added = 0;
        importReport.skippedExisting = 0;
        importReport.skippedNew = 0;
        importReport.totalProcessed = 0;
        importReport.skippedTables = [];
        importReport.tables = [];
        importError.value = '';
        importErrorCode.value = '';
        isImportDialogVisible.value = true;
    }

    async function handleImportFileSelect() {
        const userId = userStore.currentUser?.id || '';
        importPhase.value = 'reading';

        try {
            const result = await readImportFile(userId, {
                allowUserMismatch: allowUserMismatch.value
            });

            if (result.success) {
                importDataCache.value = result.data;
                importFileSummary.value = result.summary;
                importDiagnostics.value = result.diagnostics ?? null;
                importPhase.value = 'confirm';
            } else if (result.error === 'cancelled') {
                isImportDialogVisible.value = false;
                toast(t('view.settings.advanced.advanced.db_import.error_cancelled'));
            } else {
                importError.value = result.error;
                importErrorCode.value = result.errorCode ?? '';
                importPhase.value = 'error';
                toast.error(t('view.settings.advanced.advanced.db_import.error', { error: result.error }));
            }
        } catch (e) {
            console.error('[Import] readImportFile threw:', e);
            importError.value = e.message || String(e);
            importErrorCode.value = '';
            importPhase.value = 'error';
            toast.error(t('view.settings.advanced.advanced.db_import.error', { error: importError.value }));
        }
    }

    function backToStrategy() {
        importPhase.value = 'strategy';
    }

    async function handleImport() {
        if (!importDataCache.value) return;

        importInProgress.value = true;
        importPhase.value = 'importing';

        const result = await executeImport(
            importDataCache.value,
            { conflictStrategy: conflictStrategy.value, newDataStrategy: newDataStrategy.value },
            (state) => {
                if (state.phase === 'importing') {
                    importProgressPercent.value = state.progress * 100;
                }
            }
        );

        importInProgress.value = false;

        if (result.success) {
            importPhase.value = 'report';
            importReport.overwritten = result.report.overwritten;
            importReport.added = result.report.added;
            importReport.skippedExisting = result.report.skippedExisting;
            importReport.skippedNew = result.report.skippedNew;
            importReport.totalProcessed = result.report.totalProcessed;
            importReport.skippedTables = result.report.skippedTables ?? [];
            importReport.tables = result.report.tables;
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
        } else if (result.error === 'cancelled') {
            isImportDialogVisible.value = false;
            toast(t('view.settings.advanced.advanced.db_import.error_cancelled'));
        } else {
            importPhase.value = 'error';
            importError.value = result.error;
            importErrorCode.value = '';
            toast.error(t('view.settings.advanced.advanced.db_import.error', { error: result.error }));
        }
    }

    // ── Reset ──

    const isResetDialogVisible = ref(false);
    const resetPhase = ref('confirm');
    const resetInProgress = ref(false);
    const resetConfirmInput = ref('');
    const resetInputError = ref(false);
    const resetError = ref('');

    const confirmationRequiredText = computed(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}${m}${d}+我确认`;
    });

    async function handleResetDatabase() {
        const expectedText = confirmationRequiredText.value;
        if (resetConfirmInput.value !== expectedText) {
            resetInputError.value = true;
            return;
        }
        resetInputError.value = false;

        resetPhase.value = 'in_progress';
        resetInProgress.value = true;

        const msgBox = toast.warning(t('view.settings.advanced.advanced.db_reset.in_progress'), { duration: Infinity });

        try {
            const allTables = [];
            await sqliteService.execute((row) => {
                allTables.push(row[0]);
            }, `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);

            await database.begin();
            for (const tableName of allTables) {
                await sqliteService.executeNonQuery(`DROP TABLE IF EXISTS "${tableName}"`);
            }
            await database.commit();

            await database.vacuum();

            const configRepo = window.configRepository;
            await configRepo.init();
            await database.initTables();
            if (userStore.currentUser?.id) {
                await database.initUserTables(userStore.currentUser.id);
            }

            const resetLog = {
                timestamp: new Date().toISOString(),
                user: userStore.currentUser?.displayName || 'Unknown',
                userId: userStore.currentUser?.id || ''
            };
            await configRepo.setObject('reset_log', resetLog);

            toast.dismiss(msgBox);
            toast.success(t('view.settings.advanced.advanced.db_reset.success'));

            resetPhase.value = 'confirm';
            resetConfirmInput.value = '';
            isResetDialogVisible.value = false;
            resetInProgress.value = false;

            await new Promise((resolve) => setTimeout(resolve, 1500));
            vrcxUpdaterStore.restartVRCX(false);
        } catch (err) {
            console.error('Database reset failed:', err);
            toast.dismiss(msgBox);
            resetPhase.value = 'error';
            resetError.value = err.message || String(err);
            resetInProgress.value = false;
            toast.error(t('view.settings.advanced.advanced.db_reset.error', { error: resetError.value }));
        }
    }
</script>
