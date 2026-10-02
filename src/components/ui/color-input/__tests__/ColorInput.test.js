import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { ColorInput } from '..';

describe('ColorInput', () => {
    it('normalizes the surface to the model color and emits changes', async () => {
        const wrapper = mount(ColorInput, {
            props: {
                modelValue: '#ffffff',
                label: 'Accent color'
            }
        });

        expect(wrapper.attributes('data-slot')).toBe('color-input');
        expect(wrapper.find('input').attributes('aria-label')).toBe(
            'Accent color'
        );

        await wrapper.find('input').setValue('#123456');
        expect(wrapper.emitted('update:modelValue')).toEqual([['#123456']]);
        expect(wrapper.emitted('change')).toEqual([['#123456']]);
    });
});
