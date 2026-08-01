import * as XLSX from 'xlsx';

/**
 * 将数据数组转换为 JSON Blob
 * @param {Array<object>} data - 数据数组
 * @param {number} [space=2] - JSON 缩进空格数
 * @returns {Blob}
 */
export function toJsonBlob(data, space = 2) {
    const json = JSON.stringify(data, null, space);
    return new Blob([json], { type: 'application/json' });
}

/**
 * 将多个工作表数据转换为 Excel Blob
 * @param {Array<{name: string, data: Array<object>}>} sheets - 工作表数组
 * @returns {Blob}
 */
export function toExcelBlob(sheets) {
    const wb = XLSX.utils.book_new();

    for (const sheet of sheets) {
        const ws = XLSX.utils.json_to_sheet(sheet.data ?? []);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }

    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
}

/**
 * 将单个数据数组转换为 Excel Blob（默认工作表名 "Data"）
 * @param {Array<object>} data - 数据数组
 * @param {string} [sheetName='Data'] - 工作表名
 * @returns {Blob}
 */
export function dataToExcelBlob(data, sheetName = 'Data') {
    return toExcelBlob([{ name: sheetName, data }]);
}

/**
 * 通过 Electron IPC 保存文件到磁盘
 * @param {string} defaultName - 默认文件名
 * @param {Blob} blob - 文件内容
 * @param {string} [formatLabel] - 格式标签
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveFileViaDialog(defaultName, blob, formatLabel) {
    try {
        const buffer = await blob.arrayBuffer();

        // Electron path
        if (window.electron?.saveFileDialog) {
            const result = await window.electron.saveFileDialog(
                defaultName,
                formatLabel ?? 'All Files'
            );
            if (!result) {
                return { success: false, error: 'cancelled' };
            }
            await window.electron.writeFile(result, buffer);
            return { success: true };
        }

        // CefSharp path
        if (AppApi?.SaveFileSelectorDialog && AppApi?.WriteFileBytes) {
            const ext = defaultName.includes('.') ? defaultName.split('.').pop() : '';
            const filter = `${formatLabel ?? 'All Files'} (*.${ext})|*.${ext}|All files (*.*)|*.*`;
            const result = await AppApi.SaveFileSelectorDialog(
                defaultName,
                ext ? `.${ext}` : '',
                filter
            );
            if (!result) {
                return { success: false, error: 'cancelled' };
            }
            AppApi.WriteFileBytes(result, buffer);
            return { success: true };
        }

        throw new Error('No file saving method available');
    } catch (e) {
        console.error('saveFileViaDialog error:', e);
        return { success: false, error: e.message };
    }
}

/**
 * 导出 JSON 并保存到磁盘
 * @param {Array<object>} data - 数据数组
 * @param {string} defaultName - 默认文件名（不含扩展名）
 * @param {number} [space=2] - JSON 缩进空格数
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function exportJSON(data, defaultName, space = 2) {
    const blob = toJsonBlob(data, space);
    return saveFileViaDialog(
        `${defaultName}.json`,
        blob,
        'JSON Files'
    );
}

/**
 * 导出 Excel 并保存到磁盘（单工作表）
 * @param {Array<object>} data - 数据数组
 * @param {string} defaultName - 默认文件名（不含扩展名）
 * @param {string} [sheetName='Data'] - 工作表名
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function exportExcel(data, defaultName, sheetName = 'Data') {
    const blob = dataToExcelBlob(data, sheetName);
    return saveFileViaDialog(
        `${defaultName}.xlsx`,
        blob,
        'Excel Files'
    );
}

/**
 * 导出多工作表 Excel 并保存到磁盘
 * @param {Array<{name: string, data: Array<object>}>} sheets - 工作表数组
 * @param {string} defaultName - 默认文件名（不含扩展名）
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function exportExcelMultiSheet(sheets, defaultName) {
    const blob = toExcelBlob(sheets);
    return saveFileViaDialog(
        `${defaultName}.xlsx`,
        blob,
        'Excel Files'
    );
}
