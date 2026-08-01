import { defineStore } from 'pinia';
import { ref } from 'vue';
import { database } from '../services/database';
import { useFriendStore } from './friend';
import { useUserStore } from './user';
import { useTrackedNonFriendsStore } from './trackedNonFriends';

export const useManualRelationsStore = defineStore('ManualRelations', () => {
    /** @type {import('vue').Ref<Array<{userIdA: string, userIdB: string, relationType: string, addedAt: string}>>} */
    const relationsList = ref([]);
    /** @type {import('vue').Ref<Set<string>>} */
    const relationsSet = ref(new Set());
    const isLoaded = ref(false);
    
    /** @type {import('vue').Ref<Array<{userIdA: string, userIdB: string, score: number, key: string, nameA: string, nameB: string}>>} */
    const cachedSuggestions = ref([]);
    const ignoredSuggestionKeys = ref(new Set());
    const isComputingSuggestions = ref(false);
    const computingProgress = ref({ done: 0, total: 100, step: '' });

    /**
     * Build a canonical key for a pair of userIds.
     * @param {string} a
     * @param {string} b
     */
    function pairKey(a, b) {
        return [...[a, b].sort()].join('|');
    }

    /**
     * Load all manual relations from database.
     */
    async function loadManualRelations() {
        const rows = await database.getManualRelations();
        relationsList.value = rows;
        relationsSet.value = new Set(rows.map((r) => pairKey(r.userIdA, r.userIdB)));
        isLoaded.value = true;
    }

    /**
     * Add a manual relation between two users.
     * @param {string} userIdA
     * @param {string} userIdB
     * @param {string} [relationType]
     */
    async function addManualRelation(userIdA, userIdB, relationType = 'friend') {
        await database.addManualRelation(userIdA, userIdB, relationType);
        await loadManualRelations();
    }

    /**
     * Remove a manual relation between two users.
     * @param {string} userIdA
     * @param {string} userIdB
     */
    async function removeManualRelation(userIdA, userIdB) {
        await database.removeManualRelation(userIdA, userIdB);
        await loadManualRelations();
    }

    /**
     * Check if a manual relation exists between two users.
     * @param {string} userIdA
     * @param {string} userIdB
     */
    function isManualRelation(userIdA, userIdB) {
        return relationsSet.value.has(pairKey(userIdA, userIdB));
    }

    function setCachedSuggestions(suggestions) {
        cachedSuggestions.value = suggestions;
    }

    function ignoreSuggestion(key) {
        ignoredSuggestionKeys.value.add(key);
    }

    async function computeSuggestions() {
        if (isComputingSuggestions.value) return;
        const friendStore = useFriendStore();
        const userStore = useUserStore();
        const trackedNonFriendsStore = useTrackedNonFriendsStore();
        
        isComputingSuggestions.value = true;
        let worker;
        try {
            const {
                eventsByLocation,
                mySessions,
                oldMutualSnapshot
            } = await database.getCandidateCoInstances(userStore.currentUser?.id || '');

            const myFriendsSet = new Set(friendStore.friends.keys());
            const trackedSet = new Set(trackedNonFriendsStore.trackedList.map((x) => x.userId));

            // 只收集候选用户的显示名，避免把整个 cachedUsers 克隆给 worker
            const candidatesSet = new Set([...myFriendsSet, ...trackedSet]);
            const candidateIds = new Set();
            for (const sessions of eventsByLocation.values()) {
                for (const s of sessions) {
                    if (candidatesSet.has(s.userId)) candidateIds.add(s.userId);
                }
            }
            const displayNames = new Map();
            for (const id of candidateIds) {
                const user = userStore.cachedUsers.get(id);
                if (user?.displayName) displayNames.set(id, user.displayName);
            }
            const manualRelsList = await database.getManualRelations();

            computingProgress.value = { done: 0, total: 100, step: '计算中' };

            // 重计算放到 Web Worker 里执行，避免 O(F²) 配对计算阻塞主线程导致 UI 卡顿
            const result = await new Promise((resolve, reject) => {
                worker = new Worker(
                    new URL('../workers/manualRelationsWorker.js', import.meta.url),
                    { type: 'module' }
                );
                worker.onmessage = (e) => {
                    if (e.data.result) {
                        resolve(e.data.result);
                    } else if (e.data.error) {
                        reject(new Error(e.data.error));
                    }
                };
                worker.onerror = (err) => reject(err);
                worker.postMessage({
                    eventsByLocation,
                    mySessions,
                    oldMutualSnapshot,
                    myFriendsSet,
                    trackedSet,
                    displayNames,
                    manualRelsList
                });
            });

            cachedSuggestions.value = result;
        } catch (err) {
            console.error('[ManualRelations] Suggestion calculation error', err);
        } finally {
            if (worker) worker.terminate();
            isComputingSuggestions.value = false;
        }
    }

    return {
        relationsList,
        relationsSet,
        isLoaded,
        cachedSuggestions,
        ignoredSuggestionKeys,
        isComputingSuggestions,
        computingProgress,
        loadManualRelations,
        addManualRelation,
        removeManualRelation,
        isManualRelation,
        setCachedSuggestions,
        ignoreSuggestion,
        computeSuggestions,
        pairKey
    };
});
