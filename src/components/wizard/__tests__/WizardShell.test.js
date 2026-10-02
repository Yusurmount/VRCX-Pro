import { describe, expect, test } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import WizardShell from '../WizardShell.vue';

const StubIcon = {
    name: 'StubIcon',
    template: '<svg><path d="M0 0" /></svg>'
};

describe('WizardShell', () => {
    test('renders rail, counter and default-slot content', async () => {
        const wrapper = mount(WizardShell, {
            props: { currentStep: 2, totalSteps: 5, icons: { 2: StubIcon } },
            slots: { default: '<div class="wiz-panel">SHELL_PANEL_TEXT</div>' }
        });
        await flushPromises();

        const html = wrapper.html();
        expect(html).toContain('SHELL_PANEL_TEXT');
        expect(html).toContain('2 / 5');
        expect(wrapper.findAll('.wiz-progress-dot')).toHaveLength(5);
        expect(wrapper.findAll('.wiz-progress-dot.active')).toHaveLength(2);
        expect(wrapper.find('svg').exists()).toBe(true);
    });

    test('renders icon slot override', async () => {
        const wrapper = mount(WizardShell, {
            props: { currentStep: 1, totalSteps: 7 },
            slots: {
                icon: '<img class="custom-logo" />',
                default: '<div>PANEL</div>'
            }
        });
        await flushPromises();

        expect(wrapper.find('.custom-logo').exists()).toBe(true);
    });
});
