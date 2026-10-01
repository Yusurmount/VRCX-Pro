import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

const mocks = vi.hoisted(() => {
    const { ref } = require('vue');

    return {
        auth: { loginForm: ref({ loading: false }) },
        modal: { alertOpen: false, promptOpen: false, otpOpen: false }
    };
});

vi.mock('../../../stores', () => ({
    useAuthStore: () => mocks.auth,
    useModalStore: () => mocks.modal
}));

vi.mock('pinia', () => ({
    storeToRefs: (store) => store
}));

import LoginLoadingDialog from '../LoginLoadingDialog.vue';
import en from '../../../localization/en.json';

const i18n = createI18n({
    locale: 'en',
    fallbackLocale: 'en',
    legacy: false,
    globalInjection: false,
    missingWarn: false,
    fallbackWarn: false,
    messages: { en }
});

const slotStub = { template: '<div><slot /></div>' };

const stubs = {
    AlertDialog: {
        props: ['open'],
        template:
            '<div v-if="open" data-test-id="login-loading-dialog"><slot /></div>'
    },
    AlertDialogContent: slotStub,
    AlertDialogHeader: slotStub,
    AlertDialogTitle: { template: '<h2><slot /></h2>' },
    AlertDialogDescription: { template: '<p><slot /></p>' },
    Spinner: { template: '<span class="spinner-stub" />' }
};

function mountDialog() {
    return mount(LoginLoadingDialog, {
        global: {
            plugins: [i18n],
            stubs
        }
    });
}

describe('LoginLoadingDialog.vue', () => {
    beforeEach(() => {
        mocks.auth.loginForm.value.loading = false;
        mocks.modal.alertOpen = false;
        mocks.modal.promptOpen = false;
        mocks.modal.otpOpen = false;
    });

    test('stays hidden while no login is in progress', () => {
        const wrapper = mountDialog();
        expect(
            wrapper.find('[data-test-id="login-loading-dialog"]').exists()
        ).toBe(false);
    });

    test('shows title, description and spinner while logging in', () => {
        mocks.auth.loginForm.value.loading = true;
        const wrapper = mountDialog();

        const dialog = wrapper.find('[data-test-id="login-loading-dialog"]');
        expect(dialog.exists()).toBe(true);
        expect(dialog.text()).toContain(en.view.login.loggingIn.title);
        expect(dialog.text()).toContain(en.view.login.loggingIn.description);
        expect(dialog.find('.spinner-stub').exists()).toBe(true);
    });

    test.each([
        ['alert', 'alertOpen'],
        ['prompt', 'promptOpen'],
        ['otp', 'otpOpen']
    ])('hides while the %s dialog owns the screen', (_name, key) => {
        mocks.auth.loginForm.value.loading = true;
        mocks.modal[key] = true;

        const wrapper = mountDialog();
        expect(
            wrapper.find('[data-test-id="login-loading-dialog"]').exists()
        ).toBe(false);
    });
});
