import configRepository from './config';

const OOBE_COMPLETED_KEY = 'VRCX_OobeCompleted';
export const PERSONAL_WELCOME_SEEN_KEY = 'VRCX_onboarding_personal_welcome_seen';
export const DEV_FRIEND_SEEN_KEY = 'VRCX_onboarding_dev_friend_seen';

let completedCache = null;

/**
 * Whether the user has finished the first-run OOBE wizard.
 * @returns {Promise<boolean>}
 */
export async function isOobeCompleted() {
    if (completedCache === null) {
        completedCache = await configRepository.getBool(OOBE_COMPLETED_KEY, false);
    }
    return completedCache;
}

/**
 * Mark the OOBE wizard as finished. Also clears the personalized-welcome seen
 * flag so both new and returning users get the welcome dialog after entering
 * the main UI, no matter how many times they have seen it before.
 * @returns {Promise<void>}
 */
export async function completeOobe() {
    completedCache = true;
    await Promise.all([
        configRepository.setBool(OOBE_COMPLETED_KEY, true),
        configRepository.setBool(PERSONAL_WELCOME_SEEN_KEY, false)
    ]);
}

/**
 * Clear the OOBE completion flag so the first-run wizard can be shown again.
 * Useful for the UI debug tool. @returns {Promise<void>}
 */
export async function resetOobe() {
    completedCache = null;
    await configRepository.setBool(OOBE_COMPLETED_KEY, false);
}
