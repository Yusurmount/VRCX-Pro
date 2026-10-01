/**
 * Window zoom service: holds the user's manual zoom baseline and applies an
 * effective zoom (manual value capped by width-based tiers) to the webview.
 *
 * Percent units are used internally and in the UI (100 = 100%);
 * the AppApi surface uses Electron zoomLevel units:
 * level = percent / 10 - 10, percent = (level + 10) * 10.
 */

const STORAGE_KEY = 'VRCX_ZoomLevel';
const MID_TIER_MAX_WIDTH = 960;
const LOW_TIER_MAX_WIDTH = 880;
const MID_TIER_ZOOM = 90;
const LOW_TIER_ZOOM = 85;
const DEFAULT_ZOOM_PERCENT = 100;

/**
 * Effective zoom percent for a manual baseline at a given logical inner width.
 * @param {number} manualPercent
 * @param {number} logicalWidth
 * @returns {number}
 */
export function resolveEffectiveZoom(manualPercent, logicalWidth) {
    if (logicalWidth < LOW_TIER_MAX_WIDTH) {
        return Math.min(manualPercent, LOW_TIER_ZOOM);
    }
    if (logicalWidth < MID_TIER_MAX_WIDTH) {
        return Math.min(manualPercent, MID_TIER_ZOOM);
    }
    return manualPercent;
}

/**
 * @param {number} level Electron zoomLevel
 * @returns {number} percent (100 = 100%)
 */
export function zoomLevelToPercent(level) {
    return (level + 10) * 10;
}

/**
 * @param {number} percent (100 = 100%)
 * @returns {number} Electron zoomLevel
 */
export function percentToZoomLevel(percent) {
    return percent / 10 - 10;
}

let manualPercent = DEFAULT_ZOOM_PERCENT;
let appliedRatio = null;
let initialized = false;

async function readManualZoom() {
    try {
        const raw = await window.VRCXStorage.Get(STORAGE_KEY);
        const parsed = Number.parseInt(raw, 10);
        return Number.isFinite(parsed) && parsed > 0
            ? parsed
            : DEFAULT_ZOOM_PERCENT;
    } catch {
        return DEFAULT_ZOOM_PERCENT;
    }
}

async function applyEffectiveZoom() {
    const size = await window.platform?.getWindowInnerSize?.();
    if (!size || !Number.isFinite(size.width)) return;
    const ratio = resolveEffectiveZoom(manualPercent, size.width) / 100;
    if (ratio === appliedRatio) return;
    appliedRatio = ratio;
    window.platform?.setWindowZoom?.(ratio);
}

/**
 * Load the stored manual zoom, apply it for the current window size, and
 * re-apply on window resizes. Never throws; failures fall back to 100%.
 */
export async function initWindowZoom() {
    if (initialized) return;
    initialized = true;
    try {
        manualPercent = await readManualZoom();
        window.platform?.onWindowInnerResize?.(() =>
            applyEffectiveZoom().catch(() => {})
        );
        await applyEffectiveZoom();
    } catch (error) {
        console.error('initWindowZoom failed:', error);
    }
}

/**
 * @param {number} level Electron zoomLevel to persist as the manual baseline
 */
export async function setManualZoom(level) {
    manualPercent = zoomLevelToPercent(level);
    try {
        await window.VRCXStorage.Set(STORAGE_KEY, String(manualPercent));
    } catch {
        // storage failure keeps the in-memory baseline
    }
    await applyEffectiveZoom();
}

/**
 * @returns {number} current manual baseline as Electron zoomLevel
 */
export function getManualZoomLevel() {
    return percentToZoomLevel(manualPercent);
}

/** AppApi-compatible zoom surface wired in plugins/interopApi.js. */
export const windowZoomApi = {
    SetZoom: (level) => setManualZoom(level),
    GetZoom: () => Promise.resolve(getManualZoomLevel())
};
