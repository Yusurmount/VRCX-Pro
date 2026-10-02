import { queryRequest } from '../api';
import { parseLocation } from '../shared/utils/locationParser';

/**
 *
 * @param {object} instance
 */
function refreshInstancePlayerCount(instance) {
    const L = parseLocation(instance);
    if (L.isRealInstance) {
        queryRequest.fetch('instance.force', {
            worldId: L.worldId,
            instanceId: L.instanceId
        });
    }
}

export { refreshInstancePlayerCount };
