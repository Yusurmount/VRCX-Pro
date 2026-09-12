import configRepository from './config';

const OOBE_COMPLETED_KEY = 'VRCX_OobeCompleted';
const WELCOME_SEEN_KEY = 'VRCX_onboarding_welcome_seen';

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
 * Mark the OOBE wizard as finished. Also marks the legacy welcome dialog as
 * seen so SpotlightDialog does not show a redundant welcome on first entry.
 * @returns {Promise<void>}
 */
export async function completeOobe() {
    completedCache = true;
    await Promise.all([
        configRepository.setBool(OOBE_COMPLETED_KEY, true),
        configRepository.setBool(WELCOME_SEEN_KEY, true)
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
