import { avatarRequest } from '../../api';
import { applyAvatar } from '../../coordinators/avatarCoordinator';
import { processBulk } from '../../services/request';
import {
    useFavoriteStore,
    useFeedStore,
    useFriendStore,
    useGameLogStore,
    useModerationStore,
    useNotificationStore,
    useUserStore
} from '../../stores';
import { getPlatformInfo } from '../utils/avatar';

/**
 * 获取好友列表导出数据
 */
function getFriendListExportData() {
    const friendStore = useFriendStore();
    const userStore = useUserStore();
    const result = [];
    for (const [userId, friendRef] of friendStore.friends) {
        const user = userStore.cachedUsers.get(userId);
        const notes = userStore.state.notes?.get(userId);
        result.push({
            userId,
            displayName: friendRef.name ?? '',
            status: user?.status ?? friendRef.state ?? '',
            statusDescription: user?.statusDescription ?? '',
            bio: user?.bio ?? '',
            friendNumber: friendRef.ref ?? '',
            memo: friendRef.memo ?? '',
            note: notes ?? '',
            isVIP: friendRef.isVIP ?? false,
            trustLevel: user?.tags?.find((t) => t.startsWith('system_trust'))?.replace('system_trust_', '') ?? ''
        });
    }
    return result;
}

/**
 * 获取我的模型导出数据（从 API 拉取）
 */
async function getMyAvatarsExportData() {
    const map = new Map();
    await processBulk({
        fn: avatarRequest.getAvatars,
        N: -1,
        params: {
            n: 50,
            offset: 0,
            sort: 'updated',
            order: 'descending',
            releaseStatus: 'all',
            user: 'me'
        },
        handle: (args) => {
            for (const json of args.json) {
                const ref = applyAvatar(json);
                map.set(ref.id, ref);
            }
        }
    });
    return Array.from(map.values()).map((avatar) => ({
        id: avatar.id,
        name: avatar.name,
        releaseStatus: avatar.releaseStatus,
        platform: ['pc', 'android', 'ios']
            .filter((p) => getPlatformInfo(avatar.unityPackages)[p]?.platform)
            .join(', '),
        created_at: avatar.created_at,
        updated_at: avatar.updated_at
    }));
}

/**
 * 获取世界收藏导出数据
 */
function getFavoriteWorldsExportData() {
    const favoriteStore = useFavoriteStore();
    const result = [];
    for (const [groupName, worlds] of Object.entries(favoriteStore.localWorldFavorites)) {
        for (const world of worlds) {
            result.push({ groupId: groupName, worldId: world.id });
        }
    }
    for (const fav of favoriteStore.favoriteWorlds) {
        result.push({
            groupKey: fav.groupKey,
            worldId: fav.id,
            worldName: fav.ref?.name || fav.name || ''
        });
    }
    return result;
}

/**
 * 获取好友收藏导出数据
 */
function getFavoriteFriendsExportData() {
    const favoriteStore = useFavoriteStore();
    const userStore = useUserStore();
    const result = [];
    for (const [groupName, userIds] of Object.entries(favoriteStore.localFriendFavorites)) {
        for (const userId of userIds) {
            const user = userStore.cachedUsers.get(userId);
            result.push({
                groupId: groupName,
                userId,
                displayName: user?.displayName || userId
            });
        }
    }
    return result;
}

/**
 * 获取模型收藏导出数据
 */
function getFavoriteAvatarsExportData() {
    const favoriteStore = useFavoriteStore();
    const result = [];
    for (const [groupName, avatars] of Object.entries(favoriteStore.localAvatarFavorites)) {
        for (const avatar of avatars) {
            result.push({ groupId: groupName, avatarId: avatar.id });
        }
    }
    for (const fav of favoriteStore.favoriteAvatars) {
        result.push({
            groupKey: fav.groupKey,
            avatarId: fav.id,
            avatarName: fav.ref?.name || fav.name || ''
        });
    }
    return result;
}

/**
 * 统一数据导出源配置（工具 > 导出）
 * getData 可返回数组或 Promise（数组）
 */
const exportSources = {
    feed: {
        key: 'feed',
        titleKey: 'view.feed.header',
        sheetNameKey: 'view.feed.header',
        defaultFileName: 'feed',
        getData: () => useFeedStore().feedTableData ?? []
    },
    'friend-log': {
        key: 'friend-log',
        titleKey: 'view.friend_log.header',
        sheetNameKey: 'view.friend_log.header',
        defaultFileName: 'friend-log',
        getData: () => useFriendStore().friendLogTable?.data ?? []
    },
    'friend-list': {
        key: 'friend-list',
        titleKey: 'view.friend_list.header',
        sheetNameKey: 'view.friend_list.header',
        defaultFileName: 'friend-list',
        getData: getFriendListExportData
    },
    'game-log': {
        key: 'game-log',
        titleKey: 'view.game_log.header',
        sheetNameKey: 'view.game_log.header',
        defaultFileName: 'game-log',
        getData: async () => {
            const gameLogStore = useGameLogStore();
            await gameLogStore.gameLogTableLookup();
            return gameLogStore.gameLogTableData ?? [];
        }
    },
    'moderation-list': {
        key: 'moderation-list',
        titleKey: 'view.moderation.header',
        sheetNameKey: 'view.moderation.header',
        defaultFileName: 'moderation-list',
        getData: () => useModerationStore().playerModerationTable?.data ?? []
    },
    notifications: {
        key: 'notifications',
        titleKey: 'view.notification.header',
        sheetNameKey: 'view.notification.header',
        defaultFileName: 'notifications',
        getData: () => useNotificationStore().notificationTable?.data ?? []
    },
    'my-avatars': {
        key: 'my-avatars',
        titleKey: 'view.my_avatars.header',
        sheetName: 'My Avatars',
        defaultFileName: 'my-avatars',
        getData: getMyAvatarsExportData
    },
    'favorite-worlds': {
        key: 'favorite-worlds',
        titleKey: 'view.favorites.worlds',
        sheetName: 'Favorite Worlds',
        defaultFileName: 'favorite-worlds',
        getData: getFavoriteWorldsExportData
    },
    'favorite-friends': {
        key: 'favorite-friends',
        titleKey: 'view.favorites.friends',
        sheetName: 'Favorite Friends',
        defaultFileName: 'favorite-friends',
        getData: getFavoriteFriendsExportData
    },
    'favorite-avatars': {
        key: 'favorite-avatars',
        titleKey: 'view.favorites.avatars',
        sheetName: 'Favorite Avatars',
        defaultFileName: 'favorite-avatars',
        getData: getFavoriteAvatarsExportData
    }
};

export { exportSources };
