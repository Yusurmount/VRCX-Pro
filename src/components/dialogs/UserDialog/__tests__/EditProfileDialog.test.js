import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key) => key,
        locale: { value: 'en' }
    }),
    createI18n: () => ({
        global: {
            t: (key) => key,
            setLocaleMessage: vi.fn()
        },
        install: vi.fn()
    })
}));

vi.mock('vue-sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('@/api', () => ({
    userRequest: {
        saveProfile: vi.fn().mockResolvedValue({}),
        saveCurrentUser: vi.fn().mockResolvedValue({})
    }
}));

vi.mock('@/coordinators/userCoordinator', () => ({
    updateUserDialogProfile: vi.fn()
}));

vi.mock('@/stores', async () => {
    const { ref } = await vi.importActual('vue');
    const currentUser = ref({});
    const inventoryTable = ref([]);
    return {
        __stores: { currentUser, inventoryTable },
        useUserStore: () => ({
            currentUser,
            isLocalUserVrcPlusSupporter: ref(false)
        }),
        useGalleryStore: () => ({
            getInventory: vi.fn(),
            refreshGalleryTable: vi.fn(),
            inventoryTable
        }),
        useAuthStore: () => ({}),
        useModalStore: () => ({})
    };
});

vi.mock('@/components/dialogs/UserDialog/composables/useStatusPresets', () => ({
    useStatusPresets: () => ({
        presets: { value: [] },
        addPreset: vi.fn(),
        removePreset: vi.fn(),
        getStatusClass: vi.fn(),
        MAX_PRESETS: 10
    })
}));

import EditProfileDialog from '../EditProfileDialog.vue';
import { userRequest } from '@/api';
import { updateUserDialogProfile } from '@/coordinators/userCoordinator';
import { toast } from 'vue-sonner';
import { __stores } from '@/stores';

function mountComponent() {
    __stores.currentUser.value = {
        id: 'usr_me',
        status: 'active',
        statusDescription: '',
        pronouns: 'they/them',
        bio: 'Old bio',
        bioLinks: ['https://old.example'],
        bannerColor: 'ffffff',
        bannerUrl: '',
        bannerType: 'color',
        iconUrl: 'https://assets.example/icon.png'
    };

    const editProfileDialog = {
        visible: false,
        loading: false,
        selfProfileRef: {
            bio: 'Old bio',
            bioLinks: ['https://old.example'],
            bannerColor: 'ffffff',
            bannerUrl: '',
            bannerType: 'color',
            iconUrl: 'https://assets.example/icon.png',
            themeId: 'theme_default',
            backgroundType: 'default',
            backgroundTextureId: '',
            backgroundGradientBottom: '',
            backgroundGradientTop: '',
            nameplateEffect: '',
            profileEffect: '',
            iconFrame: ''
        },
        status: 'active',
        statusDescription: '',
        pronouns: 'they/them',
        bio: 'New bio',
        bioLinks: ['https://new.example'],
        bannerColor: 'ffffff',
        bannerUrl: '',
        bannerType: 'color',
        iconUrl: 'https://assets.example/icon.png',
        themeId: 'theme_default',
        backgroundType: 'default',
        backgroundTextureId: '',
        backgroundGradientBottom: '',
        backgroundGradientTop: '',
        nameplateEffect: '',
        profileEffect: '',
        iconFrame: ''
    };

    const wrapper = shallowMount(EditProfileDialog, {
        props: { editProfileDialog },
        global: {}
    });

    return { wrapper, editProfileDialog };
}

describe('EditProfileDialog.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('saves bio changes through the profile endpoint', async () => {
        const { wrapper, editProfileDialog } = mountComponent();

        await wrapper.vm.saveProfile();
        await flushPromises();

        expect(userRequest.saveProfile).toHaveBeenCalledWith({
            bio: 'New bio',
            bioLinks: ['https://new.example']
        });
        expect(userRequest.saveCurrentUser).not.toHaveBeenCalled();
        expect(updateUserDialogProfile).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith('Profile updated');
        expect(editProfileDialog.visible).toBe(false);
    });
});
