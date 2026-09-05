import { invoke } from '@tauri-apps/api/core';

/**
 * Proxy the existing class.method API over Tauri IPC.
 * The .NET backend can implement `dotnet_call` without changing callers.
 */
class InteropApi {
    requestId = 0;
    constructor() {
        return new Proxy(this, {
            get: (target, property) => {
                if (typeof property !== 'string' || property in target) {
                    return target[property];
                }
                return new Proxy(
                    {},
                    {
                        get: (_, method) => (...args) =>
                            target.callMethod(property, method, ...args)
                    }
                );
            }
        });
    }

    async callMethod(className, methodName, ...args) {
        const response = await invoke('dotnet_call', {
            className,
            methodName,
            args,
            id: ++this.requestId
        });
        if (response?.ok === false) throw new Error(response.error || 'Sidecar request failed');
        return response?.result ?? response;
    }
}

export default new InteropApi();
