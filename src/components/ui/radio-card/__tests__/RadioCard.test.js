import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, ref } from 'vue';

import { RadioCard } from '..';
import { RadioGroup } from '@/components/ui/radio-group';

const Host = defineComponent({
    components: { RadioGroup, RadioCard },
    props: {
        disabled: { type: Boolean, default: false }
    },
    setup() {
        const model = ref('alpha');
        return { model };
    },
    template: `
        <RadioGroup v-model="model" :disabled="disabled">
            <RadioCard id="rc-alpha" value="alpha" title="Alpha" description="Alpha description" />
            <RadioCard id="rc-beta" value="beta" title="Beta" />
        </RadioGroup>
    `
});

function mountHost(props = {}) {
    return mount(Host, { props });
}

describe('RadioCard', () => {
    it('renders a label hit area wired to the global radio item', () => {
        const wrapper = mountHost();

        const card = wrapper.find(
            'label[data-slot="radio-card"][for="rc-alpha"]'
        );
        expect(card.exists()).toBe(true);
        expect(card.text()).toContain('Alpha');
        expect(card.text()).toContain('Alpha description');
        expect(card.classes()).toContain(
            'has-[[data-state=checked]]:border-primary'
        );

        const radio = card.find('[data-slot="radio-group-item"]');
        expect(radio.exists()).toBe(true);
        expect(radio.attributes('id')).toBe('rc-alpha');
        expect(radio.attributes('aria-label')).toBe('Alpha');

        const betaCard = wrapper.find(
            'label[data-slot="radio-card"][for="rc-beta"]'
        );
        expect(betaCard.text()).toContain('Beta');
        expect(betaCard.find('p').exists()).toBe(false);
    });

    it('selects the option when anywhere on the card is clicked', async () => {
        const wrapper = mountHost();
        expect(wrapper.vm.model).toBe('alpha');

        await wrapper
            .find('label[data-slot="radio-card"][for="rc-beta"]')
            .trigger('click');
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.model).toBe('beta');
        const radios = wrapper.findAll('[data-slot="radio-group-item"]');
        expect(radios[0].attributes('data-state')).toBe('unchecked');
        expect(radios[1].attributes('data-state')).toBe('checked');
    });

    it('ignores card clicks while the radio group is disabled', async () => {
        const wrapper = mountHost({ disabled: true });

        await wrapper
            .find('label[data-slot="radio-card"][for="rc-beta"]')
            .trigger('click');
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.model).toBe('alpha');
    });
});
