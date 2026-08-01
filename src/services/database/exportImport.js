import sqliteService from '../sqlite.js';
import { i18n } from '@/plugins/i18n';

const EXPORT_VERSION = 1;
const EXPORT_FILE_EXT = '.vrcxdb.json';

/**
 * @typedef {Object} ExportMetadata
 * @property {number} version
 * @property {string} exportedAt
 * @property {string} userId
 */

/**
 * @typedef {Object} ExportPackage
 * @property {ExportMetadata} metadata
 * @property {Record<string, Array<Record<string, any>>>} tables
 */

/**
 * @returns {Promise<string|null>} Selected file path or null if cancelled
 */
async function getSaveFilePath() {
    const defaultName = `VRCX_DB_${new Date().toISOString().slice(0, 10)}${EXPORT_FILE_EXT}`;
    if (window.electron?.saveFileDialog) {
        return window.electron.saveFileDialog(
            defaultName,
            'VRCX Database Backup'
        );
    }
    if (AppApi?.SaveFileSelectorDialog) {
        const filter = `VRCX Database Backup (*${EXPORT_FILE_EXT})|*${EXPORT_FILE_EXT}|All files (*.*)|*.*`;
        return AppApi.SaveFileSelectorDialog(
            defaultName,
            EXPORT_FILE_EXT,
            filter
        );
    }
    return null;
}

/**
 * @returns {Promise<string|null>} Selected file path or null if cancelled
 */
async function getOpenFilePath() {
    if (window.electron?.openJsonFileDialog) {
        return window.electron.openJsonFileDialog();
    }
    if (window.electron?.openFileDialog) {
        return window.electron.openFileDialog();
    }
    if (AppApi?.OpenFileSelectorDialog) {
        const filter = `VRCX Database Backup (*${EXPORT_FILE_EXT})|*${EXPORT_FILE_EXT}|All files (*.*)|*.*`;
        return AppApi.OpenFileSelectorDialog('', EXPORT_FILE_EXT, filter);
    }
    return null;
}

/**
 * @param {string} filePath
 * @param {string} content
 * @returns {Promise<boolean>}
 */
async function writeFile(filePath, content) {
    if (window.electron?.writeFile) {
        return window.electron.writeFile(filePath, content);
    }
    if (AppApi?.WriteFileText) {
        AppApi.WriteFileText(filePath, content);
        return true;
    }
    throw new Error('No file writing method available');
}

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function readFile(filePath) {
    if (window.electron?.readFile) {
        return window.electron.readFile(filePath);
    }
    if (AppApi?.ReadFileText) {
        return AppApi.ReadFileText(filePath);
    }
    throw new Error('No file reading method available');
}

/**
 * Get column info for a table via PRAGMA
 * Returns array of { name, pk } where pk > 0 means primary key
 * @param {string} tableName
 * @returns {Promise<Array<{name: string, pk: number}>>}
 */
function getTableColumnInfo(tableName) {
    return new Promise((resolve, reject) => {
        const columns = [];
        sqliteService
            .execute((row) => {
                if (Array.isArray(row)) {
                    columns.push({ name: row[1], pk: row[5] });
                } else {
                    columns.push({ name: row.name, pk: row.pk });
                }
            }, `PRAGMA table_info("${tableName}")`)
            .then(() => resolve(columns))
            .catch(reject);
    });
}

/**
 * Get primary key column names for a table
 * @param {string} tableName
 * @returns {Promise<string[]>}
 */
async function getPrimaryKeyColumns(tableName) {
    const cols = await getTableColumnInfo(tableName);
    return cols.filter((c) => c.pk > 0).map((c) => c.name);
}

/**
 * Convert a row to a column-name-keyed object
 * @param {any} row - Row data (object or array)
 * @param {string[]} columns - Column names
 * @returns {Record<string, any>}
 */
function rowToObject(row, columns) {
    if (!row) return {};
    if (Array.isArray(row)) {
        const obj = {};
        columns.forEach((col, i) => {
            if (i < row.length) obj[col] = row[i];
        });
        return obj;
    }
    return row;
}

/**
 * Query all rows from a table
 * @param {string} tableName
 * @returns {Promise<Array<Record<string, any>>>}
 */
function queryAllRows(tableName) {
    return new Promise((resolve, reject) => {
        const columns = [];
        const rows = [];

        sqliteService
            .execute((row) => {
                const name = Array.isArray(row) ? row[1] : row.name;
                if (name) columns.push(name);
            }, `PRAGMA table_info("${tableName}")`)
            .then(() => {
                return new Promise((resolveInner, rejectInner) => {
                    sqliteService
                        .execute((row) => {
                            rows.push(rowToObject(row, columns));
                        }, `SELECT * FROM "${tableName}"`)
                        .then(() => resolveInner(rows))
                        .catch(rejectInner);
                });
            })
            .then(resolve)
            .catch(reject);
    });
}

/**
 * Get all table names from the database
 * @returns {Promise<string[]>}
 */
function getAllTableNames() {
    return new Promise((resolve, reject) => {
        const tables = [];
        sqliteService
            .execute((row) => {
                const name = Array.isArray(row) ? row[0] : row.name;
                if (name) tables.push(name);
            }, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .then(() => resolve(tables))
            .catch(reject);
    });
}

/**
 * Export all database data
 * @param {string} userId - Current user's ID for validation
 * @param {function} onProgress - Progress callback (current, total)
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export async function exportDatabaseData(userId, onProgress) {
    try {
        const filePath = await getSaveFilePath();
        if (!filePath) {
            return { success: false, error: 'cancelled' };
        }

        onProgress?.(0, 1);

        const tableNames = await getAllTableNames();

        /** @type {ExportPackage} */
        const exportPackage = {
            metadata: {
                version: EXPORT_VERSION,
                exportedAt: new Date().toISOString(),
                userId: userId || ''
            },
            tables: {}
        };

        const total = tableNames.length;
        for (let i = 0; i < total; i++) {
            const tableName = tableNames[i];
            onProgress?.(i + 1, total, tableName);
            const rows = await queryAllRows(tableName);
            exportPackage.tables[tableName] = rows;
        }

        const jsonContent = JSON.stringify(exportPackage, null, 2);
        await writeFile(filePath, jsonContent);

        return { success: true, path: filePath };
    } catch (e) {
        console.error('[Export] Failed:', e);
        return { success: false, error: e.message || String(e) };
    }
}

/**
 * Validate an import file
 * @param {ExportPackage} data
 * @param {string} currentUserId
 * @returns {{valid: boolean, reason?: string}}
 */
function validateImportData(data, currentUserId) {
    if (!data || typeof data !== 'object') {
        return {
            valid: false,
            reason: i18n.global.t(
                'view.settings.advanced.advanced.db_import.error_invalid_format'
            )
        };
    }
    if (!data.metadata || !data.metadata.version) {
        return {
            valid: false,
            reason: i18n.global.t(
                'view.settings.advanced.advanced.db_import.error_missing_metadata'
            )
        };
    }
    if (data.metadata.version !== EXPORT_VERSION) {
        return {
            valid: false,
            reason: i18n.global.t(
                'view.settings.advanced.advanced.db_import.error_version_mismatch',
                { version: EXPORT_VERSION }
            )
        };
    }
    if (!data.tables || typeof data.tables !== 'object') {
        return {
            valid: false,
            reason: i18n.global.t(
                'view.settings.advanced.advanced.db_import.error_missing_tables'
            )
        };
    }
    if (data.metadata.userId && data.metadata.userId !== currentUserId) {
        return {
            valid: false,
            reason: i18n.global.t(
                'view.settings.advanced.advanced.db_import.error_user_mismatch'
            )
        };
    }
    return { valid: true };
}

/**
 * @typedef {'overwrite'|'skip'} ConflictStrategy
 * Strategy for records that already exist in the database.
 * - 'overwrite': Update existing record with imported data
 * - 'skip': Keep existing record unchanged
 */

/**
 * @typedef {'add'|'skip'} NewDataStrategy
 * Strategy for records that don't exist in the database.
 * - 'add': Insert new record
 * - 'skip': Do not insert new record
 */

/**
 * @typedef {Object} ImportStrategies
 * @property {ConflictStrategy} conflictStrategy - How to handle existing records
 * @property {NewDataStrategy} newDataStrategy - How to handle new records
 */

/**
 * @typedef {Object} ImportFileSummary
 * @property {number} tableCount
 * @property {number} totalRecords
 * @property {Record<string, number>} recordsPerTable
 */

/**
 * @typedef {Object} TableReportEntry
 * @property {string} tableName
 * @property {number} overwritten - Records that existed and were overwritten
 * @property {number} added - Records that were newly inserted
 * @property {number} skippedExisting - Existing records skipped
 * @property {number} skippedNew - New records skipped
 */

/**
 * @typedef {Object} ImportReport
 * @property {boolean} success
 * @property {number} overwritten
 * @property {number} added
 * @property {number} skippedExisting
 * @property {number} skippedNew
 * @property {number} totalProcessed
 * @property {TableReportEntry[]} tables
 */

/**
 * Read and validate an import file
 * @param {string} currentUserId
 * @returns {Promise<{success: boolean, data?: ExportPackage, summary?: ImportFileSummary, error?: string}>}
 */
export async function readImportFile(currentUserId) {
    const filePath = await getOpenFilePath();
    if (!filePath) {
        return { success: false, error: 'cancelled' };
    }

    const content = await readFile(filePath);

    /** @type {ExportPackage} */
    let data;
    try {
        data = JSON.parse(content);
    } catch (e) {
        return {
            success: false,
            error: i18n.global.t(
                'view.settings.advanced.advanced.db_import.error_invalid_json'
            )
        };
    }

    const validation = validateImportData(data, currentUserId);
    if (!validation.valid) {
        return { success: false, error: validation.reason };
    }

    const recordsPerTable = {};
    let totalRecords = 0;
    for (const [name, rows] of Object.entries(data.tables)) {
        const count = rows.length;
        recordsPerTable[name] = count;
        totalRecords += count;
    }

    return {
        success: true,
        data,
        summary: {
            tableCount: Object.keys(data.tables).length,
            totalRecords,
            recordsPerTable
        }
    };
}

/**
 * Execute import with specified strategies
 * @param {ExportPackage} data
 * @param {ImportStrategies} strategies
 * @param {function} onProgress
 * @returns {Promise<{success: boolean, report?: ImportReport, error?: string, tablesProcessed?: number}>}
 */
export async function executeImport(data, strategies, onProgress) {
    const tableNames = Object.keys(data.tables);
    const totalRows = tableNames.reduce(
        (sum, name) => sum + data.tables[name].length,
        0
    );
    let processedRows = 0;

    /** @type {ImportReport} */
    const report = {
        success: false,
        overwritten: 0,
        added: 0,
        skippedExisting: 0,
        skippedNew: 0,
        totalProcessed: 0,
        tables: []
    };

    await sqliteService.executeNonQuery('BEGIN');

    try {
        for (const tableName of tableNames) {
            const rows = data.tables[tableName];
            if (rows.length === 0) continue;

            const columns = Object.keys(rows[0]);
            const quotedColumns = columns.map((c) => `"${c}"`).join(', ');
            const pkColumns = await getPrimaryKeyColumns(tableName);

            /** @type {TableReportEntry} */
            const tableReport = {
                tableName,
                overwritten: 0,
                added: 0,
                skippedExisting: 0,
                skippedNew: 0
            };

            for (const row of rows) {
                const values = columns.map((c) => row[c]);

                let recordExists = false;
                if (pkColumns.length > 0) {
                    const whereClauses = pkColumns
                        .map((pk, i) => `"${pk}"=@pk${i}`)
                        .join(' AND ');
                    const pkParams = {};
                    pkColumns.forEach((pk, i) => {
                        pkParams[`@pk${i}`] = row[pk];
                    });

                    recordExists = await new Promise((resolve, reject) => {
                        let found = false;
                        sqliteService
                            .execute(
                                () => {
                                    found = true;
                                },
                                `SELECT 1 FROM "${tableName}" WHERE ${whereClauses} LIMIT 1`,
                                pkParams
                            )
                            .then(() => resolve(found))
                            .catch(reject);
                    });
                }

                if (recordExists) {
                    if (strategies.conflictStrategy === 'overwrite') {
                        const setClauses = columns
                            .map((c, i) => `"${c}"=@v${i}`)
                            .join(', ');
                        const whereClauses = pkColumns
                            .map((pk, i) => `"${pk}"=@w${i}`)
                            .join(' AND ');
                        const updateParams = {};
                        columns.forEach((c, i) => {
                            updateParams[`@v${i}`] = row[c];
                        });
                        pkColumns.forEach((pk, i) => {
                            updateParams[`@w${i}`] = row[pk];
                        });
                        const sql = `UPDATE "${tableName}" SET ${setClauses} WHERE ${whereClauses}`;
                        await sqliteService.executeNonQuery(sql, updateParams);
                        tableReport.overwritten++;
                    } else {
                        tableReport.skippedExisting++;
                    }
                } else {
                    if (strategies.newDataStrategy === 'add') {
                        const paramNames = columns.map((_, i) => `@p${i}`);
                        const argsObj = {};
                        paramNames.forEach((name, i) => {
                            argsObj[name] = values[i];
                        });
                        const sql = `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${paramNames.join(', ')})`;
                        await sqliteService.executeNonQuery(sql, argsObj);
                        tableReport.added++;
                    } else {
                        tableReport.skippedNew++;
                    }
                }

                processedRows++;
                onProgress?.({
                    phase: 'importing',
                    progress: processedRows / totalRows
                });
            }

            report.tables.push(tableReport);
        }

        await sqliteService.executeNonQuery('COMMIT');

        report.success = true;
        report.overwritten = report.tables.reduce(
            (s, t) => s + t.overwritten,
            0
        );
        report.added = report.tables.reduce((s, t) => s + t.added, 0);
        report.skippedExisting = report.tables.reduce(
            (s, t) => s + t.skippedExisting,
            0
        );
        report.skippedNew = report.tables.reduce((s, t) => s + t.skippedNew, 0);
        report.totalProcessed = processedRows;

        return { success: true, report, tablesProcessed: tableNames.length };
    } catch (e) {
        await sqliteService.executeNonQuery('ROLLBACK');
        console.error('[Import] Transaction failed, rolled back:', e);
        return {
            success: false,
            report,
            tablesProcessed: tableNames.length,
            error: e.message || String(e)
        };
    }
}

/**
 * Legacy import function - kept for compatibility
 * @deprecated Use readImportFile + executeImport instead
 */
export async function importDatabaseData(currentUserId, onProgress) {
    const fileResult = await readImportFile(currentUserId);
    if (!fileResult.success) {
        return {
            success: false,
            importedCount: 0,
            tablesProcessed: 0,
            error: fileResult.error
        };
    }

    const strategies = {
        conflictStrategy: 'overwrite',
        newDataStrategy: 'add'
    };
    const execResult = await executeImport(
        fileResult.data,
        strategies,
        onProgress
    );

    if (execResult.success) {
        return {
            success: true,
            importedCount:
                execResult.report.overwritten + execResult.report.added,
            tablesProcessed: execResult.tablesProcessed
        };
    }
    return execResult;
}
