import {
    percentToZoomLevel,
    resolveEffectiveZoom,
    zoomLevelToPercent
} from '../windowZoom.js';

describe('resolveEffectiveZoom', () => {
    test('keeps manual value at or above 960 logical width', () => {
        expect(resolveEffectiveZoom(100, 1280)).toBe(100);
        expect(resolveEffectiveZoom(100, 960)).toBe(100);
        expect(resolveEffectiveZoom(120, 960)).toBe(120);
    });

    test('caps at 90% between 880 and 960', () => {
        expect(resolveEffectiveZoom(100, 959)).toBe(90);
        expect(resolveEffectiveZoom(100, 900)).toBe(90);
        expect(resolveEffectiveZoom(100, 880)).toBe(90);
    });

    test('caps at 85% below 880', () => {
        expect(resolveEffectiveZoom(100, 879)).toBe(85);
        expect(resolveEffectiveZoom(100, 800)).toBe(85);
    });

    test('never raises a manual value below the tier', () => {
        expect(resolveEffectiveZoom(80, 900)).toBe(80);
        expect(resolveEffectiveZoom(80, 850)).toBe(80);
        expect(resolveEffectiveZoom(85, 879)).toBe(85);
        expect(resolveEffectiveZoom(70, 800)).toBe(70);
    });
});

describe('zoom level conversions', () => {
    test('matches the InterfaceTab/StatusBar formulas', () => {
        expect(zoomLevelToPercent(0)).toBe(100);
        expect(percentToZoomLevel(100)).toBe(0);
        expect(zoomLevelToPercent(-1)).toBe(90);
        expect(zoomLevelToPercent(-1.5)).toBe(85);
    });

    test('round-trips between level and percent', () => {
        for (const percent of [70, 85, 90, 100, 120, 150]) {
            expect(percentToZoomLevel(zoomLevelToPercent(percent))).toBe(
                percent
            );
        }
    });
});

describe('windowZoom service', () => {
    /** @type {{ setWindowZoom: any, getWindowInnerSize: any, onWindowInnerResize: any }} */
    let platformMock;
    /** @type {{ Get: any, Set: any }} */
    let storageMock;

    beforeEach(async () => {
        vi.resetModules();
        platformMock = {
            setWindowZoom: vi.fn(() => Promise.resolve(true)),
            getWindowInnerSize: vi.fn(() =>
                Promise.resolve({ width: 1280, height: 800 })
            ),
            onWindowInnerResize: vi.fn(() => () => {})
        };
        storageMock = {
            Get: vi.fn(() => Promise.resolve('')),
            Set: vi.fn(() => Promise.resolve())
        };
        window.platform = platformMock;
        window.VRCXStorage = storageMock;
    });

    async function importService() {
        return import('../windowZoom.js');
    }

    test('applies 90% for a 900px-wide window on init', async () => {
        storageMock.Get.mockResolvedValue('100');
        platformMock.getWindowInnerSize.mockResolvedValue({
            width: 900,
            height: 600
        });
        const service = await importService();
        await service.initWindowZoom();
        expect(platformMock.setWindowZoom).toHaveBeenCalledWith(0.9);
    });

    test('applies 85% below 880 and keeps 100% at 1280', async () => {
        storageMock.Get.mockResolvedValue('100');
        platformMock.getWindowInnerSize.mockResolvedValue({
            width: 800,
            height: 600
        });
        const service = await importService();
        await service.initWindowZoom();
        expect(platformMock.setWindowZoom).toHaveBeenCalledWith(0.85);
        expect(platformMock.setWindowZoom).toHaveBeenCalledTimes(1);
    });

    test('keeps a manual baseline above the tier after resize', async () => {
        storageMock.Get.mockResolvedValue('120');
        const service = await importService();
        await service.initWindowZoom();
        expect(platformMock.setWindowZoom).toHaveBeenCalledWith(1.2);
        expect(platformMock.onWindowInnerResize).toHaveBeenCalledTimes(1);

        const onResize = platformMock.onWindowInnerResize.mock.calls[0][0];
        platformMock.getWindowInnerSize.mockResolvedValue({
            width: 1000,
            height: 700
        });
        await onResize();
        expect(platformMock.setWindowZoom).toHaveBeenLastCalledWith(1.2);

        platformMock.getWindowInnerSize.mockResolvedValue({
            width: 900,
            height: 700
        });
        await onResize();
        expect(platformMock.setWindowZoom).toHaveBeenLastCalledWith(0.9);
    });

    test('does not re-invoke setWindowZoom when the ratio is unchanged', async () => {
        storageMock.Get.mockResolvedValue('100');
        platformMock.getWindowInnerSize.mockResolvedValue({
            width: 1280,
            height: 800
        });
        const service = await importService();
        await service.initWindowZoom();
        expect(platformMock.setWindowZoom).toHaveBeenCalledTimes(1);

        const onResize = platformMock.onWindowInnerResize.mock.calls[0][0];
        await onResize();
        await onResize();
        expect(platformMock.setWindowZoom).toHaveBeenCalledTimes(1);
    });

    test('setManualZoom persists the baseline and re-applies', async () => {
        storageMock.Get.mockResolvedValue('100');
        const service = await importService();
        await service.initWindowZoom();

        await service.setManualZoom(-2);
        expect(storageMock.Set).toHaveBeenCalledWith('VRCX_ZoomLevel', '80');
        expect(platformMock.setWindowZoom).toHaveBeenLastCalledWith(0.8);
    });

    test('windowZoomApi round-trips AppApi level units', async () => {
        storageMock.Get.mockResolvedValue('');
        const service = await importService();
        await service.initWindowZoom();

        await service.windowZoomApi.SetZoom(-1.5);
        await expect(service.windowZoomApi.GetZoom()).resolves.toBe(-1.5);
        expect(storageMock.Set).toHaveBeenCalledWith('VRCX_ZoomLevel', '85');
    });

    test('falls back to 100% when storage read fails', async () => {
        storageMock.Get.mockRejectedValue(new Error('storage down'));
        platformMock.getWindowInnerSize.mockResolvedValue({
            width: 800,
            height: 600
        });
        const service = await importService();
        await service.initWindowZoom();
        expect(platformMock.setWindowZoom).toHaveBeenCalledWith(0.85);
    });

    test('skips applying when inner size is unavailable', async () => {
        platformMock.getWindowInnerSize.mockResolvedValue(null);
        const service = await importService();
        await service.initWindowZoom();
        expect(platformMock.setWindowZoom).not.toHaveBeenCalled();
    });
});
