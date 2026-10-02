<template>
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
    import { Trash2, TriangleAlert, Download } from 'lucide-vue-next';
    import { computed, reactive, ref, watch } from 'vue';
    import { toast } from 'vue-sonner';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Alert, AlertDescription } from '@/components/ui/alert';
    import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Spinner } from '@/components/ui/spinner';
    import { useI18n } from 'vue-i18n';

    import { useUserStore, useVRCXUpdaterStore } from '@/stores';
    import sqliteService from '@/services/sqlite';
    import { database } from '@/services/database';
    import { exportDatabaseData } from '@/services/database/exportImport';

    const props = defineProps({
        visible: { type: Boolean, default: false },
        // 'export' | 'reset' — which flow to start when visible turns true
        operation: { type: String, default: '' }
    });

    const emit = defineEmits(['close']);

    const { t } = useI18n();
    const userStore = useUserStore();
    const vrcxUpdaterStore = useVRCXUpdaterStore();

    function close() {
        emit('close');
    }

    watch(
        () => props.visible,
        (open) => {
            if (!open) return;
            switch (props.operation) {
                case 'export':
                    confirmExport();
                    break;
                case 'reset':
                    isResetDialogVisible.value = true;
                    break;
                default:
                    close();
            }
        }
    );

    // Operation flows are started from the parent page via the `operation` prop.

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

    // Notify the parent (the database page) once every flow dialog is closed.
    watch(
        [isExportDialogVisible, isResetDialogVisible],
        ([exportOpen, resetOpen], [prevExportOpen, prevResetOpen]) => {
            const wasOpen = prevExportOpen || prevResetOpen;
            const isOpen = exportOpen || resetOpen;
            if (wasOpen && !isOpen) {
                close();
            }
        }
    );
</script>
