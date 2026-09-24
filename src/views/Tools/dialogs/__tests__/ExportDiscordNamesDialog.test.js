import { nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

const currentUser = ref({ friends: [] });

vi.mock('pinia', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        storeToRefs: (store) => store
    };
});

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key) => key })
}));

vi.mock('../../../stores', () => ({
    useUserStore: () => ({ currentUser })
}));

vi.mock('@/components/ui/dialog', () => ({
    Dialog: {
        props: ['open'],
        template: '<div><slot /></div>'
    },
    DialogContent: { template: '<div><slot /></div>' },
    DialogHeader: { template: '<div><slot /></div>' },
    DialogTitle: { template: '<div><slot /></div>' }
}));

vi.mock('@/components/ui/input-group', () => ({
    InputGroupTextareaField: {
        props: ['modelValue'],
        template:
            '<textarea data-testid="discord-names" :value="modelValue" readonly />'
    }
}));

import ExportDiscordNamesDialog from '../ExportDiscordNamesDialog.vue';

describe('ExportDiscordNamesDialog', () => {
    it('builds Discord names from the friend map', async () => {
        const friends = new Map([
            [
                'usr_1',
                {
                    ref: {
                        displayName: 'Alice',
                        statusDescription: 'Discord: alice.name extra words'
                    }
                }
            ],
            [
                'usr_2',
                {
                    ref: {
                        displayName: 'Bob',
                        statusDescription: '',
                        bio: 'Discord username: @bob_2'
                    }
                }
            ],
            [
                'usr_3',
                {
                    ref: {
                        displayName: 'Carol',
                        statusDescription: '',
                        bio: 'Discord https://discord.com/users/carol.vrc more'
                    }
                }
            ],
            ['usr_4', { name: 'Not loaded' }]
        ]);

        const wrapper = mount(ExportDiscordNamesDialog, {
            props: {
                discordNamesDialogVisible: false,
                friends
            }
        });

        await wrapper.setProps({ discordNamesDialogVisible: true });
        await nextTick();

        expect(wrapper.get('[data-testid="discord-names"]').element.value).toBe(
            [
                'DisplayName,DiscordName',
                'Alice,alice.name',
                'Bob,bob_2',
                'Carol,carol.vrc'
            ].join('\n')
        );
    });
});
