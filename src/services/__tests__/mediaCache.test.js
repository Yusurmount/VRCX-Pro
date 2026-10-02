import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../webapi', () => ({
    default: {
        execute: vi.fn()
    }
}));

import webApiService from '../webapi';
import {
    _mediaCacheInternals,
    clearMediaCache,
    getMediaObjectUrl,
    isCacheableMediaUrl,
    loadMediaObjectUrl
} from '../mediaCache';

function makeDataUrl(bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])) {
    const base64 = Buffer.from(bytes).toString('base64');
    return `data:image/png;base64,${base64}`;
}

describe('mediaCache', () => {
    let createdUrls;

    beforeEach(() => {
        vi.clearAllMocks();
        clearMediaCache();
        createdUrls = [];
        let seq = 0;
        URL.createObjectURL = vi.fn(() => {
            const url = `blob:media-${seq++}`;
            createdUrls.push(url);
            return url;
        });
        URL.revokeObjectURL = vi.fn();
        vi.stubGlobal(
            'fetch',
            vi.fn(async (input) => {
                if (typeof input === 'string' && input.startsWith('data:')) {
                    return {
                        blob: async () =>
                            new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])])
                    };
                }
                throw new Error(`unexpected fetch: ${input}`);
            })
        );
    });

    describe('isCacheableMediaUrl', () => {
        it('accepts http(s) urls only', () => {
            expect(
                isCacheableMediaUrl('https://api.vrchat.cloud/api/1/image/x')
            ).toBe(true);
            expect(isCacheableMediaUrl('http://cdn.example/a.png')).toBe(true);
            expect(isCacheableMediaUrl('data:image/png;base64,xx')).toBe(false);
            expect(isCacheableMediaUrl('blob:abc')).toBe(false);
            expect(isCacheableMediaUrl('/images/logo.png')).toBe(false);
            expect(isCacheableMediaUrl('')).toBe(false);
            expect(isCacheableMediaUrl(undefined)).toBe(false);
        });
    });

    describe('loadMediaObjectUrl', () => {
        it('passes through non-remote urls without fetching', async () => {
            const result = await loadMediaObjectUrl('/images/logo.png');
            expect(result).toBe('/images/logo.png');
            expect(webApiService.execute).not.toHaveBeenCalled();
        });

        it('fetches a remote url once and serves later reads from cache', async () => {
            webApiService.execute.mockResolvedValue({
                status: 200,
                data: makeDataUrl()
            });

            const url = 'https://api.vrchat.cloud/api/1/image/file_1/1/256';
            const first = await loadMediaObjectUrl(url);
            const second = await loadMediaObjectUrl(url);

            expect(webApiService.execute).toHaveBeenCalledTimes(1);
            expect(first).toBe(createdUrls[0]);
            expect(second).toBe(first);
            expect(getMediaObjectUrl(url)).toBe(first);
        });

        it('deduplicates concurrent loads of the same url', async () => {
            webApiService.execute.mockResolvedValue({
                status: 200,
                data: makeDataUrl()
            });

            const url = 'https://api.vrchat.cloud/api/1/image/file_2/1/256';
            const [a, b] = await Promise.all([
                loadMediaObjectUrl(url),
                loadMediaObjectUrl(url)
            ]);

            expect(webApiService.execute).toHaveBeenCalledTimes(1);
            expect(a).toBe(b);
        });

        it('rejects when the sidecar returns a non-image response', async () => {
            webApiService.execute.mockResolvedValue({
                status: 404,
                data: '{"error":"not found"}'
            });

            await expect(
                loadMediaObjectUrl('https://api.vrchat.cloud/api/1/image/x')
            ).rejects.toThrow('media fetch failed');
            expect(
                getMediaObjectUrl('https://api.vrchat.cloud/api/1/image/x')
            ).toBe('');
        });

        it('sniffs jpeg magic bytes instead of trusting the png prefix', async () => {
            webApiService.execute.mockResolvedValue({
                status: 200,
                data: 'data:image/png;base64,' // sidecar prefix lies; blob content wins below
            });
            vi.stubGlobal(
                'fetch',
                vi.fn(async () => ({
                    blob: async () =>
                        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])])
                }))
            );

            await loadMediaObjectUrl('https://cdn.example/photo.jpg');
            expect(webApiService.execute).toHaveBeenCalledTimes(1);
        });
    });

    describe('clearMediaCache', () => {
        it('revokes object urls and empties the cache', async () => {
            webApiService.execute.mockResolvedValue({
                status: 200,
                data: makeDataUrl()
            });
            const url = 'https://api.vrchat.cloud/api/1/image/file_3/1/256';
            const objectUrl = await loadMediaObjectUrl(url);

            clearMediaCache();

            expect(URL.revokeObjectURL).toHaveBeenCalledWith(objectUrl);
            expect(getMediaObjectUrl(url)).toBe('');
            expect(_mediaCacheInternals.entries.size).toBe(0);
        });
    });
});
