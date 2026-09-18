let resolveBackendReady;
const backendReadyPromise = new Promise((resolve) => {
    resolveBackendReady = resolve;
});

export function signalBackendReady() {
    if (resolveBackendReady) {
        resolveBackendReady();
        resolveBackendReady = null;
    }
}

export { backendReadyPromise };
