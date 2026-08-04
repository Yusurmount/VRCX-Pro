import { AppDebug, logWebRequest, withQueryLog } from '../services/appConfig';
import { queryClient } from './client';
import { queryKeys } from './keys';
import { toQueryOptions } from './policies';

const RECENCY_FIELDS = [
    'updated_at',
    'updatedAt',
    'last_activity',
    'last_login',
    'memberCountSyncedAt',
    '$location_at',
    '$lastFetch',
    '$fetchedAt',
    'created_at',
    'createdAt'
];

// 单实体查询缓存条数上限：防止快速浏览用户/世界/头像/群组时缓存无上限累积
// （超出上限按 dataUpdatedAt 最旧淘汰；gcTime 到期仍会正常回收）
const ENTITY_CACHE_MAX_ENTRIES = Object.freeze({
    user: 400,
    avatar: 200,
    world: 200,
    group: 100
});

/**
 * 判断 queryKey 是否为单个实体查询键（排除成员列表/画廊/日历等复合键）
 */
function isSingleEntityKey(queryKey, type) {
    if (queryKey[0] !== type) {
        return false;
    }
    if (type === 'group') {
        // group 单实体键形如 ['group', groupId, boolean]
        return queryKey.length === 3 && typeof queryKey[2] === 'boolean';
    }
    // user/avatar/world 单实体键形如 ['user', userId]
    return queryKey.length === 2;
}

/**
 * 淘汰超出上限的实体查询缓存（按 dataUpdatedAt 最旧优先）
 */
function evictExcessEntityCache() {
    for (const [type, maxEntries] of Object.entries(
        ENTITY_CACHE_MAX_ENTRIES
    )) {
        const queries = queryClient
            .getQueryCache()
            .getAll()
            .filter(
                (query) =>
                    isSingleEntityKey(query.queryKey, type) &&
                    typeof query.state.data !== 'undefined'
            );
        if (queries.length <= maxEntries) {
            continue;
        }
        queries.sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt);
        const excess = queries.length - maxEntries;
        for (let i = 0; i < excess; i++) {
            queryClient.removeQueries({
                queryKey: queries[i].queryKey,
                exact: true
            });
        }
    }
}

/**
 *
 * @param data
 */
function getComparableEntity(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }
    if (data.ref && typeof data.ref === 'object') {
        return data.ref;
    }
    if (
        data.json &&
        typeof data.json === 'object' &&
        !Array.isArray(data.json)
    ) {
        return data.json;
    }
    return data;
}

/**
 *
 * @param value
 */
function parseTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value !== '') {
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    return null;
}

/**
 *
 * @param data
 */
function getRecencyTimestamp(data) {
    const comparable = getComparableEntity(data);
    if (!comparable) {
        return null;
    }

    for (const field of RECENCY_FIELDS) {
        const ts = parseTimestamp(comparable[field]);
        if (ts !== null) {
            return ts;
        }
    }

    return null;
}

/**
 *
 * @param currentData
 * @param nextData
 */
function shouldReplaceCurrent(currentData, nextData) {
    if (typeof currentData === 'undefined') {
        return true;
    }

    const currentTs = getRecencyTimestamp(currentData);
    const nextTs = getRecencyTimestamp(nextData);

    if (currentTs !== null && nextTs !== null) {
        return nextTs >= currentTs;
    }

    if (currentTs !== null && nextTs === null) {
        return false;
    }

    return true;
}

/**
 *
 * @param data
 */
function hasCompleteEntityData(data) {
    if (!data || typeof data !== 'object') {
        return false;
    }

    const params = data.params;
    if (!params || typeof params !== 'object') {
        return false;
    }

    const hasEntityId = Boolean(
        data?.ref?.id ||
        data?.json?.id ||
        params.userId ||
        params.avatarId ||
        params.worldId ||
        params.groupId ||
        params.fileId ||
        params.printId ||
        params.inventoryId
    );

    return hasEntityId;
}

/**
 * @param {{queryKey: unknown[], nextData: any}} options
 */
export function patchQueryDataWithRecency({ queryKey, nextData }) {
    queryClient.setQueryData(queryKey, (currentData) => {
        if (!shouldReplaceCurrent(currentData, nextData)) {
            return currentData;
        }
        return nextData;
    });
}

/**
 * @param {{queryKey: unknown[], policy: {staleTime: number, gcTime: number, retry: number, refetchOnWindowFocus: boolean}, queryFn: () => Promise<any>, label?: string}} options
 * @returns {Promise<{data: any, cache: boolean}>}
 */
export async function fetchWithEntityPolicy({
    queryKey,
    policy,
    queryFn,
    label
}) {
    const queryState = queryClient.getQueryState(queryKey);
    const isFresh =
        Boolean(queryState?.dataUpdatedAt) &&
        policy.staleTime > 0 &&
        Date.now() - queryState.dataUpdatedAt < policy.staleTime;

    const data = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => withQueryLog(queryFn),
        ...toQueryOptions(policy)
    });

    evictExcessEntityCache();

    if (isFresh) {
        logWebRequest(
            '[QUERY CACHE HIT]',
            label || queryKey[0],
            queryKey,
            data
        );
    } else {
        logWebRequest('[QUERY FETCH]', label || queryKey[0], queryKey, data);
    }

    return {
        data,
        cache: isFresh
    };
}

/**
 * @param {unknown[]} queryKey
 * @returns {Promise<void>}
 */
export async function refetchActiveEntityQuery(queryKey) {
    await queryClient.invalidateQueries({
        queryKey,
        exact: true,
        refetchType: 'active'
    });
}

/**
 * @param {{queryKey: unknown[], nextData: any}} options
 * @returns {Promise<void>}
 */
export async function patchAndRefetchActiveQuery({ queryKey, nextData }) {
    patchQueryDataWithRecency({ queryKey, nextData });
    await refetchActiveEntityQuery(queryKey);
}

/**
 * @param {object} ref
 */
export function patchUserFromEvent(ref) {
    if (!ref?.id) return;
    const queryKey = queryKeys.user(ref.id);
    const existing = queryClient.getQueryData(queryKey);
    if (!hasCompleteEntityData(existing)) return;
    patchQueryDataWithRecency({
        queryKey,
        nextData: {
            cache: false,
            json: ref,
            params: { userId: ref.id },
            ref
        }
    });
}

/**
 * @param {object} ref
 */
export function patchAvatarFromEvent(ref) {
    if (!ref?.id) return;
    const queryKey = queryKeys.avatar(ref.id);
    const existing = queryClient.getQueryData(queryKey);
    if (!hasCompleteEntityData(existing)) return;
    patchQueryDataWithRecency({
        queryKey,
        nextData: {
            cache: false,
            json: ref,
            params: { avatarId: ref.id },
            ref
        }
    });
}

/**
 * @param {object} ref
 */
export function patchWorldFromEvent(ref) {
    if (!ref?.id) return;
    const queryKey = queryKeys.world(ref.id);
    const existing = queryClient.getQueryData(queryKey);
    if (!hasCompleteEntityData(existing)) return;
    patchQueryDataWithRecency({
        queryKey,
        nextData: {
            cache: false,
            json: ref,
            params: { worldId: ref.id },
            ref
        }
    });
}

/**
 * @param {object} ref
 */
export function patchGroupFromEvent(ref) {
    if (!ref?.id) return;

    const nextData = {
        cache: false,
        json: ref,
        params: { groupId: ref.id },
        ref
    };

    const keyFalse = queryKeys.group(ref.id, false);
    const existingFalse = queryClient.getQueryData(keyFalse);
    if (hasCompleteEntityData(existingFalse)) {
        patchQueryDataWithRecency({
            queryKey: keyFalse,
            nextData
        });
    }

    const keyTrue = queryKeys.group(ref.id, true);
    const existingTrue = queryClient.getQueryData(keyTrue);
    if (hasCompleteEntityData(existingTrue)) {
        patchQueryDataWithRecency({
            queryKey: keyTrue,
            nextData
        });
    }
}

export const _entityCacheInternals = {
    hasCompleteEntityData,
    getRecencyTimestamp,
    shouldReplaceCurrent
};
