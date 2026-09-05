import * as XLSX from 'xlsx';

/**
 * 灏嗘暟鎹暟缁勮浆鎹负 JSON Blob
 * @param {Array<object>} data - 鏁版嵁鏁扮粍
 * @param {number} [space=2] - JSON 缂╄繘绌烘牸鏁?
 * @returns {Blob}
 */
export function toJsonBlob(data, space = 2) {
    const json = JSON.stringify(data, null, space);
    return new Blob([json], { type: 'application/json' });
}

/**
 * 灏嗗涓伐浣滆〃鏁版嵁杞崲涓?Excel Blob
 * @param {Array<{name: string, data: Array<object>}>} sheets - 宸ヤ綔琛ㄦ暟缁?
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
 * 灏嗗崟涓暟鎹暟缁勮浆鎹负 Excel Blob锛堥粯璁ゅ伐浣滆〃鍚?"Data"锛?
 * @param {Array<object>} data - 鏁版嵁鏁扮粍
 * @param {string} [sheetName='Data'] - 宸ヤ綔琛ㄥ悕
 * @returns {Blob}
 */
export function dataToExcelBlob(data, sheetName = 'Data') {
    return toExcelBlob([{ name: sheetName, data }]);
}

/**
 * 閫氳繃 Electron IPC 淇濆瓨鏂囦欢鍒扮鐩?
 * @param {string} defaultName - 榛樿鏂囦欢鍚?
 * @param {Blob} blob - 鏂囦欢鍐呭
 * @param {string} [formatLabel] - 鏍煎紡鏍囩
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveFileViaDialog(defaultName, blob, formatLabel) {
    try {
        const buffer = await blob.arrayBuffer();

        // Electron path
        if (window.platform?.saveFileDialog) {
            const result = await window.platform.saveFileDialog(
                defaultName,
                formatLabel ?? 'All Files'
            );
            if (!result) {
                return { success: false, error: 'cancelled' };
            }
            await window.platform.writeFile(result, buffer);
            return { success: true };
        }

        // platform path
        if (AppApi?.SaveFileSelectorDialog && AppApi?.WriteFileBytes) {
            const ext = defaultName.includes('.')
                ? defaultName.split('.').pop()
                : '';
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
 * 瀵煎嚭 JSON 骞朵繚瀛樺埌纾佺洏
 * @param {Array<object>} data - 鏁版嵁鏁扮粍
 * @param {string} defaultName - 榛樿鏂囦欢鍚嶏紙涓嶅惈鎵╁睍鍚嶏級
 * @param {number} [space=2] - JSON 缂╄繘绌烘牸鏁?
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function exportJSON(data, defaultName, space = 2) {
    const blob = toJsonBlob(data, space);
    return saveFileViaDialog(`${defaultName}.json`, blob, 'JSON Files');
}

/**
 * 瀵煎嚭 Excel 骞朵繚瀛樺埌纾佺洏锛堝崟宸ヤ綔琛級
 * @param {Array<object>} data - 鏁版嵁鏁扮粍
 * @param {string} defaultName - 榛樿鏂囦欢鍚嶏紙涓嶅惈鎵╁睍鍚嶏級
 * @param {string} [sheetName='Data'] - 宸ヤ綔琛ㄥ悕
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function exportExcel(data, defaultName, sheetName = 'Data') {
    const blob = dataToExcelBlob(data, sheetName);
    return saveFileViaDialog(`${defaultName}.xlsx`, blob, 'Excel Files');
}

/**
 * 瀵煎嚭澶氬伐浣滆〃 Excel 骞朵繚瀛樺埌纾佺洏
 * @param {Array<{name: string, data: Array<object>}>} sheets - 宸ヤ綔琛ㄦ暟缁?
 * @param {string} defaultName - 榛樿鏂囦欢鍚嶏紙涓嶅惈鎵╁睍鍚嶏級
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function exportExcelMultiSheet(sheets, defaultName) {
    const blob = toExcelBlob(sheets);
    return saveFileViaDialog(`${defaultName}.xlsx`, blob, 'Excel Files');
}
