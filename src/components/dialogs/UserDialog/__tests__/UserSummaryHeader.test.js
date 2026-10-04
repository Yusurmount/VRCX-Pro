import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import { shallowMount } from '@vue/test-utils';

vi.mock('vue-i18n', () => ({
    useI18n: () => {
        const { ref } = require('vue');
        return {
            t: (key, params) =>
                params ? `${key}:${JSON.stringify(params)}` : key,
            locale: ref('en')
        };
    },
    createI18n: () => ({
        global: { t: (key) => key },
        install: vi.fn()
    })
}));

vi.mock('../../../../plugins/router', () => {
    const { ref } = require('vue');
    return {
        router: {
            beforeEach: vi.fn(),
            push: vi.fn(),
            replace: vi.fn(),
            currentRoute: ref({ path: '/', name: '', meta: {} }),
            isReady: vi.fn().mockResolvedValue(true)
        },
        initRouter: vi.fn()
    };
});

vi.mock('vue-router', async (importOriginal) => {
    const actual = await importOriginal();
    const { ref } = require('vue');
    return {
        ...actual,
        useRouter: vi.fn(() => ({
            push: vi.fn(),
            replace: vi.fn(),
            currentRoute: ref({ path: '/', name: '', meta: {} })
        }))
    };
});

vi.mock('../../../../plugins/interopApi', () => ({ initInteropApi: vi.fn() }));
vi.mock('../../../../plugins/i18n', () => ({
    i18n: { global: { t: (key) => key } }
}));
vi.mock('@/plugins', () => ({
    i18n: { global: { t: (key) => key } },
    initPlugins: vi.fn(),
    loadLocalizedStrings: vi.fn(),
    initDayjs: vi.fn(),
    initUi: vi.fn(),
    initUiForVrOverlay: vi.fn()
}));
vi.mock('../../../../services/database', () => ({
    database: new Proxy(
        {},
        {
            get: (_target, prop) => {
                if (prop === '__esModule') return false;
                return vi.fn().mockResolvedValue(null);
            }
        }
    )
}));
vi.mock('../../../../services/config', () => ({
    default: {
        init: vi.fn(),
        getString: vi.fn().mockImplementation((_k, d) => d ?? '{}'),
        setString: vi.fn(),
        getBool: vi.fn().mockImplementation((_k, d) => d ?? false),
        setBool: vi.fn(),
        getInt: vi.fn().mockImplementation((_k, d) => d ?? 0),
        setInt: vi.fn(),
        getFloat: vi.fn().mockImplementation((_k, d) => d ?? 0),
        setFloat: vi.fn(),
        getObject: vi.fn().mockReturnValue(null),
        setObject: vi.fn(),
        getArray: vi.fn().mockImplementation((_k, d) => d ?? []),
        setArray: vi.fn(),
        remove: vi.fn()
    }
}));
vi.mock('../../../../services/jsonStorage', () => ({ default: vi.fn() }));
vi.mock('../../../../services/watchState', () => ({
    watchState: { isLoggedIn: false }
}));
vi.mock('../../../../services/request', () => ({
    request: vi.fn().mockResolvedValue({ json: {} }),
    processBulk: vi.fn(),
    buildRequestInit: vi.fn(),
    parseResponse: vi.fn(),
    shouldIgnoreError: vi.fn(),
    $throw: vi.fn(),
    failedGetRequests: new Map()
}));
vi.mock('../../../../stores/settings/general', () => ({
    useGeneralSettingsStore: () => ({ localFavoriteFriendsGroups: {} })
}));
vi.mock('../../../../coordinators/groupCoordinator', () => ({
    showGroupDialog: vi.fn()
}));

import UserSummaryHeader from '../UserSummaryHeader.vue';
import { useGameStore, useLocationStore, useUserStore } from '../../../../stores';

const noop = () => {};

const SlotStub = { template: '<div><slot /></div>' };

function mountHeader() {
    return shallowMount(UserSummaryHeader, {
        props: {
            getUserStateText: noop,
            copyUserDisplayName: noop,
            toggleBadgeVisibility: noop,
            toggleBadgeShowcased: noop,
            userDialogCommand: noop
        },
        global: {
            plugins: [pinia],
            stubs: {
                Panel: SlotStub,
                TooltipWrapper: SlotStub,
                Popover: SlotStub,
                PopoverTrigger: SlotStub,
                PopoverContent: SlotStub,
                MediaImage: SlotStub,
                IconFrame: SlotStub,
                Badge: SlotStub,
                Checkbox: SlotStub,
                teleport: true,
                transition: false
            }
        }
    });
}

let pinia;

describe('UserSummaryHeader statusDotClass', () => {
    beforeEach(() => {
        pinia = createTestingPinia({
            initialState: {
                User: {
                    currentUser: { id: 'usr_self' },
                    userDialog: {
                        visible: true,
                        loading: false,
                        id: 'usr_stranger',
                        ref: {
                            id: 'usr_stranger',
                            displayName: 'Stranger',
                            isFriend: false,
                            state: 'offline',
                            status: 'active',
                            location: 'offline'
                        },
                        publicProfileRef: {},
                        theme: {}
                    }
                },
                Location: {
                    lastLocation: {
                        date: null,
                        location: '',
                        name: '',
                        playerList: new Map(),
                        friendList: new Map()
                    }
                },
                Game: { isGameRunning: false }
            }
        });
    });

    test('离线陌生人即使接口返回 status 也不亮绿灯', async () => {
        const wrapper = mountHeader();
        await wrapper.vm.$nextTick();
        const dot = wrapper.find('.x-user-status');
        expect(dot.classes()).toContain('status-icon');
        expect(dot.classes()).toContain('offline');
        expect(dot.classes()).not.toContain('online');
    });

    test('有本地在场证据的陌生人在线上绿灯', async () => {
        const locationStore = useLocationStore();
        const gameStore = useGameStore();
        locationStore.$patch({
            lastLocation: {
                location: 'wrld_x:123~region(eu)',
                playerList: new Map([
                    [
                        'usr_stranger',
                        { id: 'usr_stranger', joinTime: Date.now() - 60000 }
                    ]
                ])
            }
        });
        gameStore.$patch({ isGameRunning: true });
        const wrapper = mountHeader();
        await wrapper.vm.$nextTick();
        const dot = wrapper.find('.x-user-status');
        expect(dot.classes()).toContain('online');
        expect(dot.classes()).not.toContain('offline');
    });

    test('离线好友保持灰色', async () => {
        const userStore = useUserStore();
        userStore.$patch({
            userDialog: {
                ref: {
                    id: 'usr_friend',
                    displayName: 'Friend',
                    isFriend: true,
                    state: 'offline',
                    status: 'active',
                    location: 'offline',
                    $online_for: 0
                }
            }
        });
        const wrapper = mountHeader();
        await wrapper.vm.$nextTick();
        const dot = wrapper.find('.x-user-status');
        expect(dot.classes()).toContain('offline');
        expect(dot.classes()).not.toContain('online');
    });
});
