export async function isSentryOptedIn() {
    return false;
}

/**
 * Guarded import, prevents leaking Sentry into non-nightly bundles.
 */
export function getSentry() {
    return NIGHTLY ? import('@sentry/vue') : null;
}

export async function initSentry(_app) {
    // Sentry error reporting disabled
    return;
}
