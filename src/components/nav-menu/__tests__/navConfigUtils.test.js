import { describe, expect, it, vi } from 'vitest';

import {
    loadStoredNavConfig,
    prefetchStoredNavConfig,
    NAV_CONFIG_KEY
} from '../navConfigUtils';

describe('navConfigUtils prefetch', () => {
    it('loadStoredNavConfig consumes the prefetched value with a single read', async () => {
        const stored = JSON.stringify({
            layout: [{ type: 'item', key: 'feed' }],
            hiddenKeys: ['tool-gallery']
        });
        const repository = {
            getString: vi.fn(() => Promise.resolve(stored))
        };

        prefetchStoredNavConfig(repository);
        const loaded = await loadStoredNavConfig(repository, []);

        expect(repository.getString).toHaveBeenCalledTimes(1);
        expect(repository.getString).toHaveBeenCalledWith(NAV_CONFIG_KEY);
        expect(loaded.layout).toEqual([{ type: 'item', key: 'feed' }]);
        expect(loaded.hiddenKeys).toEqual(['tool-gallery']);
    });

    it('reads from the repository again after the prefetch was consumed', async () => {
        const repository = {
            getString: vi.fn(() => Promise.resolve(null))
        };

        const loaded = await loadStoredNavConfig(repository, [
            { type: 'item', key: 'fallback' }
        ]);

        expect(repository.getString).toHaveBeenCalledTimes(1);
        expect(loaded.layout).toEqual([{ type: 'item', key: 'fallback' }]);
    });

    it('ignores prefetch for a different config key', async () => {
        prefetchStoredNavConfig({
            getString: vi.fn(() => Promise.resolve('{"layout":[]}'))
        });

        const repository = {
            getString: vi.fn(() => Promise.resolve(null))
        };
        await loadStoredNavConfig(repository, [], { configKey: 'other-key' });

        expect(repository.getString).toHaveBeenCalledWith('other-key');
    });
});
