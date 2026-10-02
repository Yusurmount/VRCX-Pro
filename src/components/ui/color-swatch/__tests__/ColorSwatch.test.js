import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { ColorSwatch } from '..';

describe('ColorSwatch', () => {
    it('renders the selected state and emits the selected color', async () => {
        const wrapper = mount(ColorSwatch, {
            props: {
                color: '#00b8ff',
                selected: true
            }
        });

        expect(wrapper.attributes('data-slot')).toBe('color-swatch');
        expect(wrapper.attributes('aria-pressed')).toBe('true');
        expect(wrapper.attributes('style')).toContain(
            'background-color: rgb(0, 184, 255)'
        );

        await wrapper.trigger('click');
        expect(wrapper.emitted('select')).toEqual([['#00b8ff']]);
    });
});
