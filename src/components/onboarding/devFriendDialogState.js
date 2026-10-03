import { ref } from 'vue';

/**
 * The developer's VRChat user id — the only user this dialog is about.
 */
export const DEV_FRIEND_USER_ID = 'usr_166e8c0b-cfe1-47c3-ab7e-9d14874be6ae';

/**
 * Bumped by the welcome dialog (after dismiss) and by the UI debug tool to
 * ask DevFriendDialog to open. The dialog re-reads its seen flag before
 * showing, so callers should reset the flag first when it was dismissed.
 * @type {import('vue').Ref<number>}
 */
export const devFriendDialogShowRequest = ref(0);

/**
 * Whether the current show request bypasses the friend-list condition
 * (used by the UI debug tool so the dialog can be previewed without being
 * a friend of the developer).
 * @type {import('vue').Ref<boolean>}
 */
export const devFriendDialogForce = ref(false);

/**
 * Ask the developer-friend dialog to open (again).
 * @param {boolean} [force] skip the friend-list condition
 * @returns {void}
 */
export function requestDevFriendDialogShow(force = false) {
    devFriendDialogForce.value = force;
    devFriendDialogShowRequest.value += 1;
}
