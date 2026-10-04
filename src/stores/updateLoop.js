import { defineStore } from 'pinia';
import { reactive, toRefs, watch } from 'vue';

import { database } from '../services/database';
import { groupRequest } from '../api';
import { runRefreshFriendsListFlow } from '../coordinators/friendSyncCoordinator';
import { runUpdateIsGameRunningFlow } from '../coordinators/gameCoordinator';
import { addGameLogEvent } from '../coordinators/gameLogCoordinator';
import { runRefreshPlayerModerationsFlow } from '../coordinators/moderationCoordinator';
import { clearVRCXCache } from '../coordinators/vrcxCoordinator';
import { useAuthStore } from './auth';
import { useDiscordPresenceSettingsStore } from './settings/discordPresence';
import { useFriendStore } from './friend';
import { handleGroupUserInstances } from '../coordinators/groupCoordinator';
import {
    getCurrentUser,
    updateAutoStateChange
} from '../coordinators/userCoordinator';
import { useUserStore } from './user';
import { useVRCXUpdaterStore } from './vrcxUpdater';
import { useVrStore } from './vr';
import { useVrcxStore } from './vrcx';
import { watchState } from '../services/watchState';

import * as workerTimers from 'worker-timers';

export const useUpdateLoopStore = defineStore('UpdateLoop', () => {
    const authStore = useAuthStore();
    const userStore = useUserStore();
    const friendStore = useFriendStore();
    const vrcxStore = useVrcxStore();
    const discordPresenceSettingsStore = useDiscordPresenceSettingsStore();
    const vrcxUpdaterStore = useVRCXUpdaterStore();
    const vrStore = useVrStore();
    const state = reactive({
        nextCurrentUserRefresh: 300,
        nextFriendsRefresh: 3600,
        nextGroupInstanceRefresh: 0,
        nextAppUpdateCheck: 3600,
        ipcTimeout: 0,
        nextClearVRCXCacheCheck: 86400,
        nextDiscordUpdate: 0,
        nextAutoStateChange: 0,
        nextGetLogCheck: 0,
        nextGameRunningCheck: 0,
        nextDatabaseOptimize: 3600
    });

    watch(
        () => watchState.isLoggedIn,
        () => {
            state.nextCurrentUserRefresh = 300;
            state.nextFriendsRefresh = 3600;
            state.nextGroupInstanceRefresh = 0;
        },
        { flush: 'sync' }
    );

    /**
     * 日志轮询跑在独立循环里，不与 updateLoop 共用 await 链：
     * 后者可能被慢的 VRChat API（getUsersGroupInstances，最长 60s）或游戏状态
     * 检测拖住一整轮，导致 LogWatcher.Get() 迟迟不执行、房间/玩家列表延迟。
     * 上游 VRCX 的 LogWatcher 同样是独立线程轮询，与其它 IPC 互不阻塞。
     */
    let gameLogLoopStarted = false;

    /**
     *
     */
    function startGameLogPolling() {
        if (gameLogLoopStarted) {
            return;
        }
        gameLogLoopStarted = true;
        pollGameLog();
    }

    /**
     *
     */
    async function pollGameLog() {
        try {
            if (watchState.isLoggedIn && --state.nextGetLogCheck <= 0) {
                state.nextGetLogCheck = 0.5;
                const rawLogs = await LogWatcher.Get();
                if (rawLogs) {
                    rawLogs.forEach((rawLog) => {
                        addGameLogEvent(JSON.stringify(rawLog));
                    });
                }
            }
        } catch (err) {
            console.error(err);
        }
        workerTimers.setTimeout(() => pollGameLog(), 1000);
    }

    /**
     *
     */
    async function updateLoop() {
        startGameLogPolling();
        try {
            if (watchState.isLoggedIn) {
                if (--state.nextCurrentUserRefresh <= 0) {
                    state.nextCurrentUserRefresh = 300; // 5min
                    getCurrentUser();
                }
                if (--state.nextFriendsRefresh <= 0) {
                    state.nextFriendsRefresh = 3600; // 1hour
                    runRefreshFriendsListFlow();
                    authStore.updateStoredUser(userStore.currentUser);
                    if (
                        userStore.currentUser.last_activity &&
                        new Date(userStore.currentUser.last_activity) >
                            new Date(Date.now() - 3600 * 1000) // 1hour
                    ) {
                        runRefreshPlayerModerationsFlow();
                    }
                }
                if (--state.nextGroupInstanceRefresh <= 0) {
                    if (watchState.isFriendsLoaded) {
                        state.nextGroupInstanceRefresh = 300; // 5min
                        // 不 await：VRChat API 单次可挂 60s，若阻塞本轮循环，
                        // 后面每秒一次的游戏运行状态检测会被一起拖住——漏检一次
                        // 开始/结束，玩家列表回放就会用到过期的上一次房间。
                        groupRequest
                            .getUsersGroupInstances()
                            .then(handleGroupUserInstances)
                            .catch((err) => {
                                console.error(
                                    'Failed to refresh group instances',
                                    err
                                );
                            });
                    }
                    AppApi.CheckGameRunning();
                }
                if (--state.nextAppUpdateCheck <= 0) {
                    state.nextAppUpdateCheck = 3600; // 1hour
                    if (vrcxUpdaterStore.autoUpdateVRCX !== 'Off') {
                        vrcxUpdaterStore.checkForVRCXUpdate();
                    }
                    vrcxStore.tryAutoBackupVrcRegistry();
                }
                if (--state.ipcTimeout <= 0) {
                    vrcxStore.setIpcEnabled(false);
                }
                if (
                    --state.nextClearVRCXCacheCheck <= 0 &&
                    vrcxStore.clearVRCXCacheFrequency > 0
                ) {
                    state.nextClearVRCXCacheCheck =
                        vrcxStore.clearVRCXCacheFrequency / 2;
                    clearVRCXCache();
                }
                if (--state.nextDiscordUpdate <= 0) {
                    state.nextDiscordUpdate = 3;
                    if (discordPresenceSettingsStore.discordActive) {
                        discordPresenceSettingsStore.updateDiscord();
                    }
                }
                if (--state.nextAutoStateChange <= 0) {
                    state.nextAutoStateChange = 3;
                    updateAutoStateChange();
                }
                if (--state.nextGameRunningCheck <= 0) {
                    state.nextGameRunningCheck = 1;
                    await runUpdateIsGameRunningFlow(
                        await AppApi.IsGameRunning(),
                        await AppApi.IsSteamVRRunning()
                    );
                    vrStore.vrInit(); // TODO: make this event based
                }
                if (--state.nextDatabaseOptimize <= 0) {
                    state.nextDatabaseOptimize = 86400; // 1 day
                    database.optimize().catch(console.error);
                }
            }
        } catch (err) {
            friendStore.setIsRefreshFriendsLoading(false);
            console.error(err);
        }
        workerTimers.setTimeout(() => updateLoop(), 1000);
    }

    /**
     *
     * @param value
     */
    function setNextClearVRCXCacheCheck(value) {
        state.nextClearVRCXCacheCheck = value;
    }

    /**
     *
     * @param value
     */
    function setNextGroupInstanceRefresh(value) {
        state.nextGroupInstanceRefresh = value;
    }

    /**
     *
     * @param value
     */
    function setNextDiscordUpdate(value) {
        state.nextDiscordUpdate = value;
    }

    /**
     *
     * @param value
     */
    function setIpcTimeout(value) {
        state.ipcTimeout = value;
    }

    /**
     *
     * @param value
     */
    function setNextCurrentUserRefresh(value) {
        state.nextCurrentUserRefresh = value;
    }

    /**
     * API 限流自动降速：检测到 429 后，将各轮询类刷新统一推后，避免持续高频请求触发风控。
     *
     * @param {number} value 秒数
     */
    function applyRateLimitBackoff(value) {
        state.nextCurrentUserRefresh = value;
        state.nextFriendsRefresh = value;
        state.nextGroupInstanceRefresh = value;
        state.nextDiscordUpdate = value;
    }

    return {
        ...toRefs(state),
        updateLoop,
        setIpcTimeout,
        setNextCurrentUserRefresh,
        setNextDiscordUpdate,
        setNextGroupInstanceRefresh,
        setNextClearVRCXCacheCheck,
        applyRateLimitBackoff
    };
});
