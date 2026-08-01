<template>
    <Dialog v-model:open="isVisible">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{{ title }}</DialogTitle>
                <DialogDescription>
                    {{ t('dialog.data_export.description') }}
                </DialogDescription>
            </DialogHeader>
            <div class="flex flex-col gap-4 py-2">
                <div class="flex items-center gap-3">
                    <label class="text-sm font-medium whitespace-nowrap">{{ t('dialog.data_export.format') }}</label>
                    <Select v-model="exportFormat">
                        <SelectTrigger size="sm" class="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="json">JSON</SelectItem>
                                <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
                <div v-if="previewData.length > 0" class="text-xs text-muted-foreground">
                    {{ t('dialog.data_export.record_count', { count: previewData.length }) }}
                </div>
                <div v-else class="text-xs text-muted-foreground">
                    {{ t('dialog.data_export.no_data') }}
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" size="sm" @click="isVisible = false">
                    {{ t('dialog.data_export.cancel') }}
                </Button>
                <Button size="sm" :disabled="exporting || previewData.length === 0" @click="handleExport">
                    <Loader2 v-if="exporting" class="mr-1 h-3.5 w-3.5 animate-spin" />
                    {{ t('dialog.data_export.export') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-vue-next';
import { exportJSON, exportExcel } from '@/services/export';

const { t } = useI18n();

const props = defineProps({
    visible: {
        type: Boolean,
        required: true
    },
    /** 对话框标题 */
    title: {
        type: String,
        required: true
    },
    /** 默认导出文件名（不含扩展名） */
    defaultFileName: {
        type: String,
        required: true
    },
    /** Excel 工作表名 */
    sheetName: {
        type: String,
        default: 'Data'
    },
    /** 获取导出数据的函数，返回数组 */
    getData: {
        type: Function,
        required: true
    }
});

const emit = defineEmits(['update:visible']);

const isVisible = computed({
    get: () => props.visible,
    set: (v) => emit('update:visible', v)
});

const exportFormat = ref('json');
const exporting = ref(false);
const previewData = ref([]);

watch(
    () => props.visible,
    (v) => {
        if (v) {
            exportFormat.value = 'json';
            exporting.value = false;
            // 延迟计算数据，避免阻塞 UI
            try {
                previewData.value = props.getData() ?? [];
            } catch (e) {
                console.error('DataExportDialog getData error:', e);
                previewData.value = [];
            }
        }
    }
);

async function handleExport() {
    if (exporting.value || previewData.value.length === 0) {
        return;
    }
    exporting.value = true;
    try {
        let result;
        if (exportFormat.value === 'json') {
            result = await exportJSON(previewData.value, props.defaultFileName);
        } else {
            result = await exportExcel(previewData.value, props.defaultFileName, props.sheetName);
        }
        if (result.success) {
            toast.success(t('dialog.data_export.success'));
            isVisible.value = false;
        } else if (result.error !== 'cancelled') {
            toast.error(t('dialog.data_export.error', { error: result.error }));
        }
    } catch (e) {
        console.error('handleExport error:', e);
        toast.error(t('dialog.data_export.error', { error: e.message }));
    } finally {
        exporting.value = false;
    }
}
</script>
