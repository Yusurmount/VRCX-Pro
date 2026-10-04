import { useGameStore, useLocationStore, useUserStore } from '../stores';
import { resolveUserPresence } from '../shared/utils';

/**
 * Store 感知的用户在线状态解析。
 * VRChat 对非好友可能把 state/status/location 一律返回 offline，
 * 这里用游戏日志的当前实例玩家列表作为本地在场证据补全展示值。
 */
export function useUserPresence() {
    const userStore = useUserStore();
    const locationStore = useLocationStore();
    const gameStore = useGameStore();

    /**
     * @param {object} user 用户 ref
     * @returns {object} 展示用用户对象（无派生时即原 ref）
     */
    function resolveFor(user) {
        if (!user) {
            return user;
        }
        const player = user.id
            ? locationStore.lastLocation.playerList.get(user.id)
            : undefined;
        return resolveUserPresence(user, {
            isSelf: Boolean(user.id) && user.id === userStore.currentUser.id,
            gameRunning: gameStore.isGameRunning,
            inMyInstance: Boolean(player),
            myLocation: locationStore.lastLocation.location,
            joinTime: player?.joinTime ?? 0
        });
    }

    return { resolveFor };
}
