import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getBool: vi.fn(),
    setBool: vi.fn()
}));

vi.mock('../config', () => ({
    default: {
        getBool: (...a) => mocks.getBool(...a),
        setBool: (...a) => mocks.setBool(...a)
    }
}));

import { completeOobe, PERSONAL_WELCOME_SEEN_KEY } from '../oobe';

describe('oobe service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.setBool.mockResolvedValue(undefined);
    });

    test('personal welcome seen key is the shared onboarding flag', () => {
        expect(PERSONAL_WELCOME_SEEN_KEY).toBe('VRCX_onboarding_personal_welcome_seen');
    });

    test('completeOobe marks OOBE done and clears the welcome seen flag', async () => {
        await completeOobe();

        expect(mocks.setBool).toHaveBeenCalledWith('VRCX_OobeCompleted', true);
        expect(mocks.setBool).toHaveBeenCalledWith(PERSONAL_WELCOME_SEEN_KEY, false);
    });
});
