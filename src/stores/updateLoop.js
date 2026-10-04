import { defineStore } from 'pinia';
import { reactive, toRefs, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

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
     * 日志获取由 Rust 原生线程的 1s 滴答（`start_gamelog_tick` →
     * `gamelog-tick` 事件）驱动：WebView2 渲染器在窗口最小化/被完全遮挡时
     * 会冻结，webview 侧一切定时器（含 worker-timers）停摆，原生线程不受
     * 影响；渲染器恢复的瞬间积压滴答立即送达，看窗口即刷新。滴答不带数据，
     * 前端收到后自行 Get——事件留在 sidecar 队列直到真正处理，冻结期间不丢。
     * worker-timers 循环保留为兜底；轮询均先调度下一轮、在途守卫、超时竞速，
     * 单次 Get 挂起/单个事件抛错不终止处理。
     */
    let gameLogLoopStarted = false;
    let gameLogGetInFlight = false;

    /**
     *
     */
    function startGameLogPolling() {
        if (gameLogLoopStarted) {
            return;
        }
        gameLogLoopStarted = true;
        pollGameLog();
        window.platform?.ready
            .then(() =>
                Promise.all([
                    invoke('start_gamelog_tick'),
                    listen('gamelog-tick', () => {
                        if (!gameLogGetInFlight) {
                            pollGameLogOnce();
                        }
                    })
                ])
            )
            .catch(console.error);
        // 渲染器从冻结中恢复后，worker-timers 的 worker 定时链可能已死
        // （worker 死亡会让下方循环永久停摆）；窗口重新可见时用主线程直接
        // 补拉一次，保证看到窗口即刷新，不依赖 worker 存活。
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !gameLogGetInFlight) {
                pollGameLogOnce();
            }
        });
    }

    /**
     * 单次 Get+处理，不经过 worker 定时链（用于渲染器恢复后的立即补拉）。
     */
    async function pollGameLogOnce() {
        if (!watchState.isLoggedIn) {
            return;
        }
        gameLogGetInFlight = true;
        try {
            const rawLogs = await LogWatcher.Get();
            if (rawLogs) {
                rawLogs.forEach((rawLog) => {
                    try {
                        addGameLogEvent(JSON.stringify(rawLog));
                    } catch (err) {
                        console.error('gameLog event failed', rawLog, err);
                    }
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            gameLogGetInFlight = false;
        }
    }

    /**
     * 先调度下一轮再处理本批：任何一次 Get 挂起/事件抛错都只影响当前一轮，
     * 不会终止轮询循环（循环死亡后房间/玩家列表只能靠 Ctrl+F5 重放恢复）。
     */
    async function pollGameLog() {
        workerTimers.setTimeout(() => pollGameLog(), 1000);
        try {
            if (
                watchState.isLoggedIn &&
                --state.nextGetLogCheck <= 0 &&
                !gameLogGetInFlight
            ) {
                state.nextGetLogCheck = 4;
                gameLogGetInFlight = true;
                let rawLogs;
                try {
                    // 挂起的 Get 超时后放弃该批响应（属异常路径），保住循环；
                    // 在途守卫避免重复入队堆积 sidecar 阻塞线程。
                    rawLogs = await Promise.race([
                        LogWatcher.Get(),
                        new Promise((resolve) =>
                            workerTimers.setTimeout(() => resolve(undefined), 10000)
                        )
                    ]);
                } finally {
                    gameLogGetInFlight = false;
                }
                if (rawLogs) {
                    rawLogs.forEach((rawLog) => {
                        try {
                            addGameLogEvent(JSON.stringify(rawLog));
                        } catch (err) {
                            console.error('gameLog event failed', rawLog, err);
                        }
                    });
                }
            }
        } catch (err) {
            console.error(err);
        }
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
