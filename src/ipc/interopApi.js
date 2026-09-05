import { invoke } from '@tauri-apps/api/core';

/**
 * Proxy the existing class.method API over Tauri IPC.
 * The .NET backend can implement `dotnet_call` without changing callers.
 */
class InteropApi {
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

    callMethod(className, methodName, ...args) {
        return invoke('dotnet_call', { className, methodName, args });
    }
}

export default new InteropApi();
