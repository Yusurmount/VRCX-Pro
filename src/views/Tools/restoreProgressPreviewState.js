import { ref } from 'vue';

/**
 * Bumped by the UI debug tool to ask DatabaseManagement to open the restore
 * wizard in progress-preview mode (simulated progress, no database writes).
 * @type {import('vue').Ref<number>}
 */
export const restoreProgressPreviewRequest = ref(0);

/**
 * Ask the restore wizard to open in progress-preview mode.
 * @returns {void}
 */
export function requestRestoreProgressPreview() {
    restoreProgressPreviewRequest.value += 1;
}

/**
 * Take the pending preview request, if any, so it fires exactly once.
 * @returns {boolean} whether a preview was requested
 */
export function consumeRestoreProgressPreview() {
    if (restoreProgressPreviewRequest.value === 0) return false;
    restoreProgressPreviewRequest.value = 0;
    return true;
}
