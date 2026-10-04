import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key) => key })
}));

vi.mock('@/components/ui/button', () => ({
    Button: { template: '<button><slot /></button>' }
}));

vi.mock('@/components/ui/checkbox', () => ({
    Checkbox: {
        props: ['modelValue'],
        emits: ['update:modelValue'],
        template: '<input type="checkbox" />'
    }
}));

vi.mock('@/components/ui/dialog', () => ({
    Dialog: {
        emits: ['update:open'],
        template: '<div><slot /></div>'
    },
    DialogContent: { template: '<div><slot /></div>' },
    DialogHeader: { template: '<div><slot /></div>' },
    DialogTitle: { template: '<h2><slot /></h2>' },
    DialogFooter: { template: '<div><slot /></div>' }
}));

vi.mock('@/components/ui/input', () => ({
    Input: { template: '<input />' }
}));

vi.mock('@/components/ui/popover', () => ({
    Popover: { template: '<div><slot /></div>' },
    PopoverContent: { template: '<div><slot /></div>' },
    PopoverTrigger: { template: '<div><slot /></div>' }
}));

vi.mock('@/components/ui/scroll-area', () => ({
    ScrollArea: { template: '<div><slot /></div>' }
}));

vi.mock('@/components/ui/select', () => ({
    Select: { template: '<div><slot /></div>' },
    SelectContent: { template: '<div><slot /></div>' },
    SelectItem: { template: '<div><slot /></div>' },
    SelectTrigger: { template: '<div><slot /></div>' },
    SelectValue: { template: '<span><slot /></span>' }
}));

vi.mock('@/components/ui/virtual-combobox', () => ({
    VirtualCombobox: { template: '<div />' }
}));

vi.mock('@/composables/useUserDisplay', () => ({
    useUserDisplay: () => ({ userImage: vi.fn() })
}));

vi.mock('@/stores', () => ({
    useFriendStore: () => ({ friends: new Map() }),
    useModalStore: () => ({ prompt: vi.fn(), confirm: vi.fn() })
}));

vi.mock('@/services/config', () => ({
    default: {
        getArray: vi.fn(async () => []),
        setArray: vi.fn(async () => undefined)
    }
}));

vi.mock('lucide-vue-next', () => ({
    Check: { template: '<i />' },
    ChevronsUpDown: { template: '<i />' },
    Plus: { template: '<i />' },
    RotateCcw: { template: '<i />' },
    Save: { template: '<i />' },
    Trash2: { template: '<i />' },
    X: { template: '<i />' }
}));

import PlayerListFilterDialog from '../dialogs/PlayerListFilterDialog.vue';
import { createDefaultFilterState } from '../playerListFilters';

function mountDialog() {
    return mount(PlayerListFilterDialog, {
        props: {
            open: true,
            initialState: createDefaultFilterState(),
            groupSearchList: []
        }
    });
}

describe('PlayerListFilterDialog.vue — trust level options', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('uses the trust colour keys from the friend-name colour algorithm', async () => {
        const wrapper = mountDialog();
        await nextTick();

        expect(wrapper.vm.levelOptions.map((option) => option.key)).toEqual([
            'untrusted',
            'basic',
            'known',
            'trusted',
            'veteran',
            'vip',
            'troll',
            'unknown'
        ]);
    });

    test('labels come from the settings friend-name colour block', async () => {
        const wrapper = mountDialog();
        await nextTick();
        wrapper.vm.state.level.enabled = true;
        await nextTick();

        const text = wrapper.text();
        for (const name of [
            'visitor',
            'new_user',
            'user',
            'known_user',
            'trusted_user',
            'vrchat_team',
            'nuisance'
        ]) {
            expect(text).toContain(
                `view.settings.appearance.user_colors.trust_levels.${name}`
            );
        }
        expect(text).not.toContain('settings.general.user_colors');
        expect(text).toContain('view.player_list.filter.level_unknown');
    });
});
