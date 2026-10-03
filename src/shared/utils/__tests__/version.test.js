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

    test('ranks release above beta above it for the same version number', () => {
        expect(compareVersionNumbers('3.7.1', '3.7.1-it')).toBeGreaterThan(0);
        expect(compareVersionNumbers('3.7.1-beta', '3.7.1-it')).toBeGreaterThan(
            0
        );
        expect(compareVersionNumbers('3.7.1', '3.7.1-beta')).toBeGreaterThan(0);
        expect(
            compareVersionNumbers('VRCX-Pro 3.7.1-it', 'v3.7.1-beta')
        ).toBeLessThan(0);
        expect(
            compareVersionNumbers('3.7.1-beta', 'VRCX-Pro 3.7.1')
        ).toBeLessThan(0);
        expect(compareVersionNumbers('3.7.1-it', '3.7.1-it')).toBe(0);
    });
});
