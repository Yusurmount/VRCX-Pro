import { describe, expect, test } from 'vitest';

import { compareVersionNumbers } from '../version';

describe('compareVersionNumbers', () => {
    test('compares prefixed and dotted release versions', () => {
        expect(
            compareVersionNumbers('VRCX-Pro 3.4.0', 'v3.3.0')
        ).toBeGreaterThan(0);
        expect(compareVersionNumbers('VRCX-Pro 3.3.0', 'v3.4.0')).toBeLessThan(
            0
        );
        expect(compareVersionNumbers('VRCX-Pro Nightly 3.4.0', '3.4.0')).toBe(
            0
        );
    });

    test('returns null when a version number cannot be parsed', () => {
        expect(compareVersionNumbers('custom build', 'v3.4.0')).toBeNull();
    });
});
