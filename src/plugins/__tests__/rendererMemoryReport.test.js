import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startRendererMemoryThresholdReport } from '../rendererMemoryReport';

describe('rendererMemoryReport', () => {
    const sentry = {
        withScope: vi.fn((callback) =>
            callback({
                setLevel: vi.fn(),
                setTag: vi.fn(),
                setContext: vi.fn()
            })
        ),
        captureMessage: vi.fn()
    };

    beforeEach(() => {
        vi.useFakeTimers();
        Object.defineProperty(window.performance, 'memory', {
            configurable: true,
            value: { usedJSHeapSize: 90, jsHeapSizeLimit: 100 }
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns a stoppable controller and prevents duplicate monitoring', () => {
        const first = startRendererMemoryThresholdReport(sentry, {
            intervalMs: 100,
            thresholdRatio: 0.8,
            cooldownMs: 0
        });
        const second = startRendererMemoryThresholdReport(sentry, {
            intervalMs: 100,
            thresholdRatio: 0.8,
            cooldownMs: 0
        });

        expect(first).toBe(second);
        expect(first).toHaveProperty('stop');

        vi.advanceTimersByTime(100);
        expect(sentry.captureMessage).toHaveBeenCalledTimes(1);

        first.stop();
        vi.advanceTimersByTime(100);
        expect(sentry.captureMessage).toHaveBeenCalledTimes(1);

        const restarted = startRendererMemoryThresholdReport(sentry, {
            intervalMs: 100,
            thresholdRatio: 0.8,
            cooldownMs: 0
        });
        expect(restarted).not.toBe(first);
        restarted.stop();
    });
});
