export function createRateLimiter({ limitPerInterval, intervalMs }) {
    const timestamps = new Uint32Array(limitPerInterval);
    let head = 0;
    let count = 0;

    function evictOld(now) {
        const cutoff = now - intervalMs;
        while (count > 0 && timestamps[head % limitPerInterval] <= cutoff) {
            head = (head + 1) % limitPerInterval;
            count--;
        }
    }

    async function throttle() {
        const now = Date.now() >>> 0;
        evictOld(now);
        if (count >= limitPerInterval) {
            const oldest = timestamps[head % limitPerInterval];
            const wait = intervalMs - (now - oldest);
            if (wait > 0) {
                await new Promise((resolve) => setTimeout(resolve, wait));
            }
            // After waiting, evict again
            const now2 = Date.now() >>> 0;
            evictOld(now2);
        }
        const pos = (head + count) % limitPerInterval;
        timestamps[pos] = Date.now() >>> 0;
        count++;
    }

    return {
        async schedule(fn) {
            await throttle();
            return fn();
        },
        async wait() {
            await throttle();
        },
        clear() {
            head = 0;
            count = 0;
        }
    };
}