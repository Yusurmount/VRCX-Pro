import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';

vi.mock('../../services/mediaCache', () => ({
    isCacheableMediaUrl: (url) =>
        typeof url === 'string' && /^https?:\/\//i.test(url),
    getMediaObjectUrl: vi.fn(() => ''),
    loadMediaObjectUrl: vi.fn()
}));

import {
    getMediaObjectUrl,
    loadMediaObjectUrl
} from '../../services/mediaCache';
import { useMediaSrc } from '../useMediaSrc';

describe('useMediaSrc', () => {
    it('passes through non-remote urls synchronously', () => {
        const source = ref('/images/logo.png');
        const { displaySrc } = useMediaSrc(source);
        expect(displaySrc.value).toBe('/images/logo.png');
        expect(loadMediaObjectUrl).not.toHaveBeenCalled();
    });

    it('serves a cached object url synchronously', () => {
        getMediaObjectUrl.mockReturnValue('blob:cached');
        const source = ref('https://cdn.example/a.png');
        const { displaySrc } = useMediaSrc(source);
        expect(displaySrc.value).toBe('blob:cached');
        expect(loadMediaObjectUrl).not.toHaveBeenCalled();
    });

    it('loads a remote url and resolves to the object url', async () => {
        getMediaObjectUrl.mockReturnValue('');
        loadMediaObjectUrl.mockResolvedValue('blob:fetched');
        const source = ref('https://cdn.example/b.png');
        const { displaySrc } = useMediaSrc(source);

        expect(displaySrc.value).toBe('');
        await nextTick();
        await nextTick();
        expect(displaySrc.value).toBe('blob:fetched');
    });

    it('falls back to the original url when loading fails', async () => {
        getMediaObjectUrl.mockReturnValue('');
        loadMediaObjectUrl.mockRejectedValue(new Error('boom'));
        const source = ref('https://cdn.example/c.png');
        const { displaySrc } = useMediaSrc(source);

        await nextTick();
        await nextTick();
        expect(displaySrc.value).toBe('https://cdn.example/c.png');
    });

    it('re-resolves when the source url changes', async () => {
        getMediaObjectUrl.mockReturnValue('');
        loadMediaObjectUrl
            .mockResolvedValueOnce('blob:one')
            .mockResolvedValueOnce('blob:two');
        const source = ref('https://cdn.example/1.png');
        const { displaySrc } = useMediaSrc(source);
        await nextTick();
        await nextTick();
        expect(displaySrc.value).toBe('blob:one');

        source.value = 'https://cdn.example/2.png';
        await nextTick();
        await nextTick();
        expect(displaySrc.value).toBe('blob:two');
    });
});
