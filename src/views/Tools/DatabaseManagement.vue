<template>
    <div class="x-container">
        <div class="options-container">
            <div class="flex items-center gap-2 ml-2">
                <Button variant="ghost" size="sm" class="mr-3" @click="goBack">
                    <ArrowLeft />
                    {{ t('nav_tooltip.tools') }}
                </Button>
                <span class="header">{{ t('view.settings.advanced.advanced.db_manage.title') }}</span>
            </div>

            <!-- Overview -->
            <div class="mt-5 px-5">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-base font-semibold">
                        {{ t('view.tools.database_page.overview_header') }}
                    </span>
                    <Button variant="outline" size="sm" :disabled="loading" @click="refreshAll">
                        <RefreshCw class="h-4 w-4 mr-1" />
                        {{ t('view.settings.advanced.advanced.sqlite_table_size.refresh') }}
                    </Button>
                </div>

                <div class="grid grid-cols-3 gap-3 text-sm">
                    <div class="rounded-md border p-3 col-span-3">
                        <div class="text-muted-foreground">
                            {{ t('view.tools.database_page.path') }}
                        </div>
                        <div class="font-mono text-xs mt-1 break-all">
                            {{ dbInfo.path || '-' }}
                        </div>
                    </div>
                    <div class="rounded-md border p-3">
                        <div class="text-muted-foreground">
                            {{ t('view.tools.database_page.size') }}
                        </div>
                        <div class="font-medium mt-1">{{ formatSize(dbInfo.sizeBytes) }}</div>
                    </div>
                    <div class="rounded-md border p-3">
                        <div class="text-muted-foreground">
                            {{ t('view.tools.database_page.journal_mode') }}
                        </div>
                        <div class="font-medium mt-1">{{ dbInfo.journalMode || '-' }}</div>
                    </div>
                    <div class="rounded-md border p-3">
                        <div class="text-muted-foreground">
                            {{ t('view.tools.database_page.table_count') }}
                        </div>
                        <div class="font-medium mt-1">{{ tables.length }}</div>
                    </div>
                </div>
            </div>

            <!-- Tables & preview -->
            <div class="mt-6 px-5 grid grid-cols-2 gap-4 items-start">
                <div>
                    <span class="text-base font-semibold">
                        {{ t('view.tools.database_page.tables_header') }}
                    </span>
                    <div class="mt-3 max-h-96 overflow-y-auto rounded-md border divide-y">
                        <button
                            v-for="tbl in tables"
                            :key="tbl.name"
                            type="button"
                            class="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
                            :class="selectedTable === tbl.name ? 'bg-muted' : ''"
                            @click="selectTable(tbl.name)">
                            <span class="truncate font-mono text-xs mr-2">{{ tbl.name }}</span>
                            <span class="text-muted-foreground shrink-0 text-xs">
                                {{ tbl.rowCount.toLocaleString() }}
                            </span>
                        </button>
                        <div v-if="!tables.length" class="px-3 py-2 text-sm text-muted-foreground">
                            <div v-if="loading" class="flex justify-center py-4">
                                <Spinner class="h-5 w-5" />
                            </div>
                            <template v-else>{{ t('view.tools.database_page.select_hint') }}</template>
                        </div>
                    </div>
                </div>

                <div>
                    <span class="text-base font-semibold">
                        {{ selectedTable || t('view.tools.database_page.select_hint') }}
                    </span>

                    <div v-if="selectedTable" class="mt-3 flex flex-col gap-3">
                        <div v-if="preview.schema">
                            <div class="text-sm text-muted-foreground mb-1">
                                {{ t('view.tools.database_page.schema_header') }}
                            </div>
                            <pre
                                class="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all"
                                >{{ preview.schema }}</pre>
                        </div>

                        <div>
                            <div class="text-sm text-muted-foreground mb-1">
                                {{
                                    t('view.tools.database_page.preview_header', {
                                        count: PREVIEW_LIMIT
                                    })
                                }}
                            </div>
                            <div v-if="preview.loading" class="flex justify-center py-6">
                                <Spinner class="h-5 w-5" />
                            </div>
                            <div
                                v-else-if="!preview.rows.length"
                                class="text-sm text-muted-foreground rounded-md border p-3">
                                {{ t('view.tools.database_page.empty_preview') }}
                            </div>
                            <div v-else class="overflow-x-auto rounded-md border max-h-96 overflow-y-auto">
                                <table class="w-full text-xs">
                                    <thead class="sticky top-0 bg-background">
                                        <tr class="border-b">
                                            <th
                                                v-for="col in preview.columns"
                                                :key="col"
                                                class="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                                                {{ col }}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for="(row, rowIdx) in preview.rows"
                                            :key="rowIdx"
                                            class="border-b last:border-b-0 hover:bg-muted/50">
                                            <td
                                                v-for="(col, colIdx) in preview.columns"
                                                :key="col"
                                                class="px-2 py-1.5 font-mono whitespace-nowrap max-w-64 truncate"
                                                :title="formatCell(row[colIdx])">
                                                {{ formatCell(row[colIdx]) }}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Operations -->
            <div class="mt-6 px-5 mb-6">
                <span class="text-base font-semibold">
                    {{ t('view.tools.database_page.operations_header') }}
                </span>
                <div class="grid grid-cols-2 gap-4 mt-3">
                    <div class="rounded-md border p-4 flex flex-col gap-2">
                        <span class="text-sm font-medium">
                            {{ t('view.settings.advanced.advanced.db_export.button') }}
                        </span>
                        <p class="text-xs text-muted-foreground grow">
                            {{ t('view.settings.advanced.advanced.db_export.description') }}
                        </p>
                        <Button size="sm" class="self-start" @click="openOperation('export')">
                            <Download class="h-4 w-4 mr-1" />
                            {{ t('view.settings.advanced.advanced.db_export.button') }}
                        </Button>
                    </div>
                    <div class="rounded-md border p-4 flex flex-col gap-2">
                        <span class="text-sm font-medium">
                            {{ t('view.settings.advanced.advanced.db_import.button') }}
                        </span>
                        <p class="text-xs text-muted-foreground grow">
                            {{ t('view.settings.advanced.advanced.db_import.description') }}
                        </p>
                        <Button size="sm" class="self-start" @click="openOperation('import')">
                            <Upload class="h-4 w-4 mr-1" />
                            {{ t('view.settings.advanced.advanced.db_import.button') }}
                        </Button>
                    </div>
                    <div class="rounded-md border p-4 flex flex-col gap-2">
                        <span class="text-sm font-medium">
                            {{ t('view.tools.database_page.optimize') }}
                        </span>
                        <p class="text-xs text-muted-foreground grow">
                            {{ t('view.tools.database_page.optimize_description') }}
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            class="self-start"
                            :disabled="optimizing"
                            @click="handleOptimize">
                            <Sparkles class="h-4 w-4 mr-1" />
                            {{
                                optimizing
                                    ? t('view.tools.database_page.optimizing')
                                    : t('view.tools.database_page.optimize')
                            }}
                        </Button>
                    </div>
                    <div class="rounded-md border p-4 flex flex-col gap-2">
                        <span class="text-sm font-medium">
                            {{ t('view.settings.advanced.advanced.db_reset.button') }}
                        </span>
                        <p class="text-xs text-muted-foreground grow">
                            {{ t('view.settings.advanced.advanced.db_reset.warning_confirmation') }}
                        </p>
                        <Button size="sm" variant="destructive" class="self-start" @click="openOperation('reset')">
                            <Trash2 class="h-4 w-4 mr-1" />
                            {{ t('view.settings.advanced.advanced.db_reset.button') }}
                        </Button>
                    </div>
                </div>
            </div>
        </div>

        <DatabaseManagementDialog :visible="dialogVisible" :operation="dialogOperation" @close="handleDialogClose" />
    </div>
</template>

<script setup>
    import { onActivated, onMounted, reactive, ref, shallowRef } from 'vue';
    import { useRouter } from 'vue-router';
    import { useI18n } from 'vue-i18n';
    import { toast } from 'vue-sonner';
    import { ArrowLeft, Download, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-vue-next';

    import { Button } from '@/components/ui/button';
    import { Spinner } from '@/components/ui/spinner';
    import sqliteService from '@/services/sqlite';
    import { database } from '@/services/database';

    import DatabaseManagementDialog from './dialogs/DatabaseManagementDialog.vue';

    const PREVIEW_LIMIT = 50;

    const router = useRouter();
    const { t } = useI18n();

    const dbInfo = reactive({ path: '', sizeBytes: 0, journalMode: '' });
    const tables = shallowRef([]);
    const tableSchemas = new Map();
    const selectedTable = ref('');
    const preview = reactive({ columns: [], rows: [], schema: '', loading: false });
    const loading = ref(false);
    const optimizing = ref(false);

    const dialogVisible = ref(false);
    const dialogOperation = ref('');

    function goBack() {
        router.push({ name: 'tools' });
    }

    function quoteIdent(name) {
        return `"${String(name).replace(/"/g, '""')}"`;
    }

    function formatSize(bytes) {
        if (!bytes || bytes < 0) return '-';
        const units = ['B', 'KB', 'MB', 'GB'];
        let value = bytes;
        let unit = 0;
        while (value >= 1024 && unit < units.length - 1) {
            value /= 1024;
            unit += 1;
        }
        const digits = unit === 0 || Number.isInteger(value) ? 0 : 1;
        return `${value.toFixed(digits)} ${units[unit]}`;
    }

    function formatCell(value) {
        if (value === null || value === undefined) return '';
        if (Array.isArray(value)) {
            return `[binary ×${value.length}]`;
        }
        if (typeof value === 'object') {
            const text = JSON.stringify(value);
            return text.length > 200 ? `${text.slice(0, 200)}…` : text;
        }
        const text = String(value);
        return text.length > 200 ? `${text.slice(0, 200)}…` : text;
    }

    async function loadOverview() {
        const dbList = [];
        await sqliteService.execute((row) => dbList.push(row), 'PRAGMA database_list');
        const mainEntry = dbList.find((row) => row[1] === 'main');
        dbInfo.path = mainEntry?.[2] || '';

        let pageCount = 0;
        let pageSize = 0;
        await sqliteService.execute((row) => {
            pageCount = Number(row[0]);
        }, 'PRAGMA page_count');
        await sqliteService.execute((row) => {
            pageSize = Number(row[0]);
        }, 'PRAGMA page_size');
        dbInfo.sizeBytes = pageCount * pageSize;

        await sqliteService.execute((row) => {
            dbInfo.journalMode = String(row[0] ?? '');
        }, 'PRAGMA journal_mode');
    }

    async function loadTables() {
        const names = [];
        await sqliteService.execute(
            (row) => names.push(row[0]),
            `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
        );

        tableSchemas.clear();
        await sqliteService.execute((row) => {
            if (row[0]) tableSchemas.set(row[0], row[1] || '');
        }, `SELECT name, sql FROM sqlite_master WHERE type='table'`);

        // 所有行数合并为一条 UNION ALL 查询，避免逐表串行往返
        const counts = new Map();
        if (names.length) {
            const unionSql = names
                .map(
                    (name) =>
                        `SELECT '${String(name).replace(/'/g, "''")}' AS tbl, COUNT(*) AS cnt FROM ${quoteIdent(name)}`
                )
                .join(' UNION ALL ');
            await sqliteService.execute((row) => {
                counts.set(row[0], Number(row[1]));
            }, unionSql);
        }
        tables.value = names.map((name) => ({
            name,
            rowCount: counts.get(name) ?? 0
        }));
    }

    async function refreshAll() {
        if (loading.value) return;
        loading.value = true;
        try {
            await Promise.all([loadOverview(), loadTables()]);
        } catch (e) {
            toast.error(t('view.tools.database_page.load_error', { error: e?.message || String(e) }));
        } finally {
            loading.value = false;
        }
    }

    async function selectTable(name) {
        selectedTable.value = name;
        preview.schema = tableSchemas.get(name) || '';
        preview.columns = [];
        preview.rows = [];
        preview.loading = true;
        try {
            const columns = [];
            await sqliteService.execute((row) => columns.push(row[1]), `PRAGMA table_info(${quoteIdent(name)})`);
            const rows = [];
            await sqliteService.execute(
                (row) => rows.push(row),
                `SELECT * FROM ${quoteIdent(name)} LIMIT ${PREVIEW_LIMIT}`
            );
            preview.columns = columns;
            preview.rows = rows;
        } catch (e) {
            toast.error(t('view.tools.database_page.load_error', { error: e?.message || String(e) }));
        } finally {
            preview.loading = false;
        }
    }

    function openOperation(operation) {
        dialogOperation.value = operation;
        dialogVisible.value = true;
    }

    async function handleDialogClose() {
        dialogVisible.value = false;
        await refreshAll();
    }

    async function handleOptimize() {
        optimizing.value = true;
        try {
            await database.vacuum();
            await database.optimize();
            toast.success(t('view.tools.database_page.optimize_success'));
            await refreshAll();
        } catch (e) {
            toast.error(t('view.tools.database_page.optimize_error', { error: e?.message || String(e) }));
        } finally {
            optimizing.value = false;
        }
    }

    onMounted(refreshAll);
    onActivated(refreshAll);
</script>
