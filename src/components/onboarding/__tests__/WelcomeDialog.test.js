import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createI18n } from 'vue-i18n';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

import en from '../../../localization/en.json';

const mocks = vi.hoisted(() => ({
    getBool: vi.fn(),
    setBool: vi.fn()
}));

vi.mock('../../../services/config', () => ({
    default: {
        getBool: (...a) => mocks.getBool(...a),
        setBool: (...a) => mocks.setBool(...a)
    }
}));

const currentUser = ref({
    id: 'usr_123',
    displayName: 'TestUser',
    thumbnailUrl: 'https://example.com/thumb.png'
});

vi.mock('../../../stores', () => ({
    useUserStore: () => ({ currentUser: currentUser.value })
}));

import WelcomeDialog from '../WelcomeDialog.vue';

const i18n = createI18n({
    locale: 'en',
    fallbackLocale: 'en',
    legacy: false,
    globalInjection: false,
    missingWarn: false,
    fallbackWarn: false,
    messages: { en }
});

// Render children directly so assertions do not depend on reka-ui portals.
const stubs = {
    Dialog: {
        template: '<div class="dialog-stub" v-if="open"><slot /></div>',
        props: ['open']
    },
    DialogContent: {
        template: '<div class="dialog-content-stub"><slot /></div>'
    },
    Avatar: { template: '<div class="avatar-stub"><slot /></div>' },
    AvatarImage: {
        template: '<img class="avatar-image-stub" :src="src" />',
        props: ['src', 'alt']
    },
    AvatarFallback: { template: '<span class="avatar-fallback-stub"><slot /></span>' }
};

function mountDialog() {
    return mount(WelcomeDialog, {
        global: {
            plugins: [i18n],
            stubs
        }
    });
}

/**
 * Let the onMounted flag read settle, then run the open delay.
 * @param {import('@vue/test-utils').VueWrapper} wrapper
 * @returns {Promise<void>}
 */
async function passOpenDelay(wrapper) {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(800);
    await wrapper.vm.$nextTick();
}

describe('WelcomeDialog.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        currentUser.value = {
            id: 'usr_123',
            displayName: 'TestUser',
            thumbnailUrl: 'https://example.com/thumb.png'
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('opens once when the seen flag is unset and shows nickname and avatar', async () => {
        mocks.getBool.mockResolvedValue(false);

        const wrapper = mountDialog();
        await passOpenDelay(wrapper);

        expect(mocks.getBool).toHaveBeenCalledWith(
            'VRCX_onboarding_personal_welcome_seen',
            false
        );
        expect(wrapper.find('.dialog-stub').exists()).toBe(true);
        expect(wrapper.text()).toContain('TestUser');
        expect(wrapper.find('.avatar-image-stub').attributes('src')).toBe(
            'https://example.com/thumb.png'
        );
    });

    test('stays closed when the seen flag is set', async () => {
        mocks.getBool.mockResolvedValue(true);

        const wrapper = mountDialog();
        await passOpenDelay(wrapper);

        expect(wrapper.find('.dialog-stub').exists()).toBe(false);
        expect(mocks.setBool).not.toHaveBeenCalled();
    });

    test('dismiss marks the welcome as seen', async () => {
        mocks.getBool.mockResolvedValue(false);

        const wrapper = mountDialog();
        await passOpenDelay(wrapper);

        const cta = wrapper
            .findAll('button')
            .find((b) => b.text() === en.onboarding.welcome.cta);
        expect(cta).toBeTruthy();
        await cta.trigger('click');
        await wrapper.vm.$nextTick();

        expect(mocks.setBool).toHaveBeenCalledWith(
            'VRCX_onboarding_personal_welcome_seen',
            true
        );
        expect(wrapper.find('.dialog-stub').exists()).toBe(false);
    });
});
