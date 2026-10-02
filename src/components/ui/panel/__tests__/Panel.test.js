import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { Panel } from '..';

describe('Panel', () => {
    it('renders the default library surface', () => {
        const wrapper = mount(Panel, {
            slots: {
                default: 'Content'
            }
        });

        expect(wrapper.attributes('data-slot')).toBe('panel');
        expect(wrapper.classes()).toContain('bg-card');
        expect(wrapper.classes()).toContain('rounded-xl');
        expect(wrapper.classes()).toContain('p-3');
        expect(wrapper.text()).toBe('Content');
    });

    it('supports muted surfaces and explicit padding', () => {
        const wrapper = mount(Panel, {
            props: {
                variant: 'muted',
                padding: 'sm'
            }
        });

        expect(wrapper.classes()).toContain('bg-muted/80');
        expect(wrapper.classes()).toContain('p-2');
        expect(wrapper.classes()).not.toContain('p-3');
    });
});
