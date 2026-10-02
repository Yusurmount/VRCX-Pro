import { ref } from 'vue';

/**
 * Bumped by the UI debug tool to force the personal welcome dialog open
 * again without restarting the app or re-logging in.
 * @type {import('vue').Ref<number>}
 */
export const welcomeDialogShowRequest = ref(0);

/**
 * Ask the personal welcome dialog to open (again). The dialog re-reads its
 * seen flag before showing, so callers should reset the flag first when it
 * has already been dismissed.
 * @returns {void}
 */
export function requestWelcomeDialogShow() {
    welcomeDialogShowRequest.value += 1;
}
