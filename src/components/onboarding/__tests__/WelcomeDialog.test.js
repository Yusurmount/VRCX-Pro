import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createI18n } from 'vue-i18n';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

import en from '../../../localization/en.json';

const mocks = vi.hoisted(() => ({
    getBool: vi.fn(),
    setBool: vi.fn(),
    closeWhatsNewDialog: vi.fn(),
    showLatestWhatsNewDialog: vi.fn(),
    whatsNewDialog: null
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

vi.mock('../../../stores', async () => {
    const { ref } = await import('vue');
    const whatsNewDialog = ref({ visible: false, titleKey: '', subtitleKey: '', items: [] });
    mocks.whatsNewDialog = whatsNewDialog;
    return {
        useUserStore: () => ({ currentUser: currentUser.value }),
        useVRCXUpdaterStore: () => ({
            whatsNewDialog,
            closeWhatsNewDialog: (...a) => mocks.closeWhatsNewDialog(...a),
            showLatestWhatsNewDialog: (...a) => mocks.showLatestWhatsNewDialog(...a)
        })
    };
});

import WelcomeDialog from '../WelcomeDialog.vue';
import {
    requestWelcomeDialogShow,
    welcomeDialogShowRequest
} from '../welcomeDialogState';

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
        welcomeDialogShowRequest.value = 0;
        mocks.whatsNewDialog.value = { visible: false, titleKey: '', subtitleKey: '', items: [] };
        // Mimic the real store: filling publishes the latest release content.
        mocks.showLatestWhatsNewDialog.mockImplementation(async () => {
            mocks.whatsNewDialog.value = {
                visible: true,
                titleKey: 'onboarding.whatsnew.releases.2026_05_03.title',
                subtitleKey: 'onboarding.whatsnew.releases.2026_05_03.subtitle',
                items: [
                    {
                        key: 'chart_analysis',
                        icon: 'chart-no-axes-combined',
                        titleKey:
                            'onboarding.whatsnew.releases.2026_05_03.items.chart_analysis.title',
                        descriptionKey:
                            'onboarding.whatsnew.releases.2026_05_03.items.chart_analysis.description'
                    }
                ]
            };
            return true;
        });
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
        expect(mocks.closeWhatsNewDialog).toHaveBeenCalled();
        expect(wrapper.find('.dialog-stub').exists()).toBe(false);
    });

    test('UI debug show request re-opens the dialog after dismiss', async () => {
        mocks.getBool.mockResolvedValue(false);

        const wrapper = mountDialog();
        await passOpenDelay(wrapper);

        const cta = wrapper
            .findAll('button')
            .find((b) => b.text() === en.onboarding.welcome.cta);
        await cta.trigger('click');
        await wrapper.vm.$nextTick();
        expect(wrapper.find('.dialog-stub').exists()).toBe(false);

        // Simulate the UI debug tool: reset the seen flag, then request a show.
        mocks.getBool.mockResolvedValue(false);
        requestWelcomeDialogShow();
        await wrapper.vm.$nextTick();
        await passOpenDelay(wrapper);

        expect(wrapper.find('.dialog-stub').exists()).toBe(true);
    });

    test('shows release features below the welcome message', async () => {
        mocks.getBool.mockResolvedValue(false);
        mocks.whatsNewDialog.value = {
            visible: true,
            titleKey: 'onboarding.whatsnew.releases.2026_05_03.title',
            subtitleKey: 'onboarding.whatsnew.releases.2026_05_03.subtitle',
            items: [
                {
                    key: 'chart_analysis',
                    icon: 'chart-no-axes-combined',
                    titleKey: 'onboarding.whatsnew.releases.2026_05_03.items.chart_analysis.title',
                    descriptionKey:
                        'onboarding.whatsnew.releases.2026_05_03.items.chart_analysis.description'
                }
            ]
        };

        const wrapper = mountDialog();
        await passOpenDelay(wrapper);

        const text = wrapper.text();
        const featureTitle =
            en.onboarding.whatsnew.releases['2026_05_03'].items.chart_analysis.title;
        expect(text).toContain(en.onboarding.welcome.title);
        expect(text).toContain(featureTitle);
        expect(text.indexOf(en.onboarding.welcome.title)).toBeLessThan(
            text.indexOf(featureTitle)
        );
        expect(text).toContain(en.onboarding.welcome.cta);
        expect(mocks.showLatestWhatsNewDialog).not.toHaveBeenCalled();
    });

    test('fills the latest release content when opening without an announcement', async () => {
        mocks.getBool.mockResolvedValue(false);

        const wrapper = mountDialog();
        await passOpenDelay(wrapper);

        expect(mocks.showLatestWhatsNewDialog).toHaveBeenCalled();
        const featureTitle =
            en.onboarding.whatsnew.releases['2026_05_03'].items.chart_analysis.title;
        expect(wrapper.text()).toContain(en.onboarding.welcome.title);
        expect(wrapper.text()).toContain(featureTitle);
        expect(wrapper.text()).toContain(en.onboarding.welcome.cta);
    });

    test('stays closed when the welcome has been seen even with release content', async () => {
        mocks.getBool.mockResolvedValue(true);
        mocks.whatsNewDialog.value = {
            visible: true,
            titleKey: 'onboarding.whatsnew.releases.2026_05_03.title',
            subtitleKey: 'onboarding.whatsnew.releases.2026_05_03.subtitle',
            items: [
                {
                    key: 'chart_analysis',
                    icon: 'chart-no-axes-combined',
                    titleKey: 'onboarding.whatsnew.releases.2026_05_03.items.chart_analysis.title',
                    descriptionKey:
                        'onboarding.whatsnew.releases.2026_05_03.items.chart_analysis.description'
                }
            ]
        };

        const wrapper = mountDialog();
        await passOpenDelay(wrapper);

        expect(wrapper.find('.dialog-stub').exists()).toBe(false);
    });

    test('opens when a release announcement clears the seen flag after mount', async () => {
        mocks.getBool.mockResolvedValue(true);

        const wrapper = mountDialog();
        await passOpenDelay(wrapper);
        expect(wrapper.find('.dialog-stub').exists()).toBe(false);

        // The store clears the seen flag first, then publishes release content.
        mocks.getBool.mockResolvedValue(false);
        mocks.whatsNewDialog.value = {
            visible: true,
            titleKey: 'onboarding.whatsnew.releases.2026_05_03.title',
            subtitleKey: 'onboarding.whatsnew.releases.2026_05_03.subtitle',
            items: [
                {
                    key: 'chart_analysis',
                    icon: 'chart-no-axes-combined',
                    titleKey: 'onboarding.whatsnew.releases.2026_05_03.items.chart_analysis.title',
                    descriptionKey:
                        'onboarding.whatsnew.releases.2026_05_03.items.chart_analysis.description'
                }
            ]
        };
        await wrapper.vm.$nextTick();
        await passOpenDelay(wrapper);

        expect(wrapper.find('.dialog-stub').exists()).toBe(true);
        const featureTitle =
            en.onboarding.whatsnew.releases['2026_05_03'].items.chart_analysis.title;
        expect(wrapper.text()).toContain(featureTitle);
        const cta = wrapper
            .findAll('button')
            .find((b) => b.text() === en.onboarding.welcome.cta);
        expect(cta).toBeTruthy();
    });
});
