import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createI18n } from 'vue-i18n';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';

import en from '../../../localization/en.json';

const mocks = vi.hoisted(() => ({
    getBool: vi.fn(),
    setBool: vi.fn(),
    openExternalLink: vi.fn(),
    getUser: vi.fn(),
    friends: null,
    cachedUsers: null,
    currentUser: null
}));

vi.mock('../../../services/config', () => ({
    default: {
        getBool: (...a) => mocks.getBool(...a),
        setBool: (...a) => mocks.setBool(...a)
    }
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

vi.mock('@/api', () => ({
    userRequest: {
        getUser: (...a) => mocks.getUser(...a)
    }
}));

vi.mock('../../../composables/useUserDisplay', () => ({
    useUserDisplay: () => ({
        userImage: (user) => user?.thumbnailUrl ?? ''
    })
}));

vi.mock('../../../stores', () => ({
    useFriendStore: () => ({ friends: mocks.friends }),
    useUserStore: () => ({ cachedUsers: mocks.cachedUsers, currentUser: mocks.currentUser })
}));

vi.mock('../../../shared/utils/appActions', () => ({
    openExternalLink: (...a) => mocks.openExternalLink(...a)
}));

import DevFriendDialog from '../DevFriendDialog.vue';
import confetti from 'canvas-confetti';
import {
    DEV_FRIEND_USER_ID,
    devFriendDialogForce,
    devFriendDialogShowRequest,
    requestDevFriendDialogShow
} from '../devFriendDialogState';
import { DEV_FRIEND_SEEN_KEY } from '../../../services/oobe';
import { watchState } from '../../../services/watchState';

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
    return mount(DevFriendDialog, {
        global: {
            plugins: [i18n],
            stubs
        }
    });
}

/**
 * Drain the async gate (seen-flag read + friends-loaded wait).
 * @returns {Promise<void>}
 */
async function flush() {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}

/**
 * Drain the async gate, then run the open delay.
 * @param {import('@vue/test-utils').VueWrapper} wrapper
 * @returns {Promise<void>}
 */
async function passOpenDelay(wrapper) {
    await flush();
    await vi.advanceTimersByTimeAsync(500);
    await wrapper.vm.$nextTick();
}

/**
 * Put the developer into the mocked friend list.
 * @returns {void}
 */
function addDeveloperFriend() {
    mocks.friends.set(DEV_FRIEND_USER_ID, {
        id: DEV_FRIEND_USER_ID,
        name: '雨小凌',
        ref: {
            displayName: '雨小凌',
            thumbnailUrl: 'https://example.com/dev.png'
        }
    });
}

describe('DevFriendDialog.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        devFriendDialogShowRequest.value = 0;
        devFriendDialogForce.value = false;
        watchState.isFriendsLoaded = false;
        mocks.friends = reactive(new Map());
        mocks.cachedUsers = reactive(new Map());
        mocks.currentUser = { id: 'usr_me' };
        // Mimic the real API: applyUser caches the fetched profile.
        mocks.getUser.mockImplementation(async () => {
            mocks.cachedUsers.set(DEV_FRIEND_USER_ID, {
                id: DEV_FRIEND_USER_ID,
                displayName: '雨小凌',
                thumbnailUrl: 'https://example.com/dev.png'
            });
            return {};
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('opens after the show request when the developer is a friend', async () => {
        mocks.getBool.mockResolvedValue(false);
        watchState.isFriendsLoaded = true;
        addDeveloperFriend();

        const wrapper = mountDialog();
        requestDevFriendDialogShow();
        await passOpenDelay(wrapper);

        expect(wrapper.find('.dialog-stub').exists()).toBe(true);
        const text = wrapper.text();
        expect(text).toContain(en.onboarding.devFriend.title);
        expect(text).toContain(en.onboarding.devFriend.body);
        expect(text).toContain(en.onboarding.devFriend.contact_title);
        expect(text).toContain(en.onboarding.devFriend.qq_value);
        expect(wrapper.find('.avatar-image-stub').attributes('src')).toBe(
            'https://example.com/dev.png'
        );
        expect(text).toContain(en.onboarding.devFriend.cta);
        expect(mocks.getUser).not.toHaveBeenCalled();
        expect(confetti).toHaveBeenCalled();
        // Above the dialog portal stacking context (BASE_Z_INDEX 10000).
        expect(confetti).toHaveBeenCalledWith(expect.objectContaining({ zIndex: 20000 }));
    });

    test('stays closed when the developer is not a friend', async () => {
        mocks.getBool.mockResolvedValue(false);
        watchState.isFriendsLoaded = true;

        const wrapper = mountDialog();
        requestDevFriendDialogShow();
        await passOpenDelay(wrapper);

        expect(wrapper.find('.dialog-stub').exists()).toBe(false);
        expect(mocks.setBool).not.toHaveBeenCalled();
        expect(mocks.getUser).not.toHaveBeenCalled();
        expect(confetti).not.toHaveBeenCalled();
    });

    test('opens for the developer\'s own account without being in the friend list', async () => {
        mocks.getBool.mockResolvedValue(false);
        watchState.isFriendsLoaded = true;
        mocks.currentUser = { id: DEV_FRIEND_USER_ID };

        const wrapper = mountDialog();
        requestDevFriendDialogShow();
        await passOpenDelay(wrapper);

        expect(wrapper.find('.dialog-stub').exists()).toBe(true);
        // No local profile data for self either → fetches it for the avatar.
        expect(mocks.getUser).toHaveBeenCalledWith({ userId: DEV_FRIEND_USER_ID });
    });

    test('waits for the friend list to load before deciding', async () => {
        mocks.getBool.mockResolvedValue(false);
        watchState.isFriendsLoaded = false;
        addDeveloperFriend();

        const wrapper = mountDialog();
        requestDevFriendDialogShow();
        await passOpenDelay(wrapper);
        expect(wrapper.find('.dialog-stub').exists()).toBe(false);

        watchState.isFriendsLoaded = true;
        await wrapper.vm.$nextTick();
        await passOpenDelay(wrapper);

        expect(wrapper.find('.dialog-stub').exists()).toBe(true);
    });

    test('stays closed when the seen flag is set', async () => {
        mocks.getBool.mockResolvedValue(true);
        watchState.isFriendsLoaded = true;
        addDeveloperFriend();

        const wrapper = mountDialog();
        requestDevFriendDialogShow();
        await passOpenDelay(wrapper);

        expect(wrapper.find('.dialog-stub').exists()).toBe(false);
    });

    test('force fetches the developer profile when no local data exists', async () => {
        mocks.getBool.mockResolvedValue(false);
        watchState.isFriendsLoaded = true;

        const wrapper = mountDialog();
        requestDevFriendDialogShow(true);
        await passOpenDelay(wrapper);

        expect(mocks.getUser).toHaveBeenCalledWith({ userId: DEV_FRIEND_USER_ID });
        expect(wrapper.find('.dialog-stub').exists()).toBe(true);
        expect(wrapper.find('.avatar-image-stub').attributes('src')).toBe(
            'https://example.com/dev.png'
        );
        expect(wrapper.find('.avatar-fallback-stub').text()).toBe('雨');
    });

    test('dismiss marks the dialog as seen', async () => {
        mocks.getBool.mockResolvedValue(false);
        watchState.isFriendsLoaded = true;
        addDeveloperFriend();

        const wrapper = mountDialog();
        requestDevFriendDialogShow();
        await passOpenDelay(wrapper);

        const cta = wrapper
            .findAll('button')
            .find((b) => b.text() === en.onboarding.devFriend.cta);
        expect(cta).toBeTruthy();
        await cta.trigger('click');
        await wrapper.vm.$nextTick();

        expect(mocks.setBool).toHaveBeenCalledWith(DEV_FRIEND_SEEN_KEY, true);
        expect(wrapper.find('.dialog-stub').exists()).toBe(false);
    });

    test('other-contact row opens the external profile link', async () => {
        mocks.getBool.mockResolvedValue(false);
        watchState.isFriendsLoaded = true;
        addDeveloperFriend();

        const wrapper = mountDialog();
        requestDevFriendDialogShow();
        await passOpenDelay(wrapper);

        const link = wrapper
            .findAll('button')
            .find((b) => b.text() === en.onboarding.devFriend.other_value);
        expect(link).toBeTruthy();
        await link.trigger('click');
        expect(mocks.openExternalLink).toHaveBeenCalledWith('https://yusurmount.github.io/about/');
    });
});
