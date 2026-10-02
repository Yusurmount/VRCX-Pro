import configRepository from './config';

const OOBE_COMPLETED_KEY = 'VRCX_OobeCompleted';

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
 * Mark the OOBE wizard as finished.
 * @returns {Promise<void>}
 */
export async function completeOobe() {
    completedCache = true;
    await configRepository.setBool(OOBE_COMPLETED_KEY, true);
}

/**
 * Clear the OOBE completion flag so the first-run wizard can be shown again.
 * Useful for the UI debug tool. @returns {Promise<void>}
 */
export async function resetOobe() {
    completedCache = null;
    await configRepository.setBool(OOBE_COMPLETED_KEY, false);
}
