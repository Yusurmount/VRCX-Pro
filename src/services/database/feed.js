import { dbVars } from '../database';

import sqliteService from '../sqlite.js';

// Fallback fetch limit when maxTableSize/searchTableSize are unusable.
const DEFAULT_FEED_ENTRY_LIMIT = 25;

function parseFeedFilters(filters) {
    const types = {
        gps: true,
        status: true,
        bio: true,
        avatar: true,
        online: true,
        offline: true
    };
    if (filters.length > 0) {
        types.gps = false;
        types.status = false;
        types.bio = false;
        types.avatar = false;
        types.online = false;
        types.offline = false;
        for (const f of filters) {
            if (f === 'GPS') types.gps = true;
            else if (f === 'Status') types.status = true;
            else if (f === 'Bio') types.bio = true;
            else if (f === 'Avatar') types.avatar = true;
            else if (f === 'Online') types.online = true;
            else if (f === 'Offline') types.offline = true;
        }
    }
    return types;
}

function buildVipQuery(vipList) {
    if (!vipList || vipList.length === 0) return { vipQuery: '', vipArgs: {} };
    const vipPlaceholders = [];
    const vipArgs = {};
    for (let i = 0; i < vipList.length; i++) {
        const key = `@vip_${i}`;
        vipArgs[key] = vipList[i];
        vipPlaceholders.push(key);
    }
    return {
        vipQuery: `AND user_id IN (${vipPlaceholders.join(', ')})`,
        vipArgs
    };
}

const BASE_COLUMNS =
    'id, created_at, user_id, display_name, type, location, world_name, previous_location, time, group_name, status, status_description, previous_status, previous_status_description, bio, previous_bio, owner_id, avatar_name, current_avatar_image_url, current_avatar_thumbnail_image_url, previous_current_avatar_image_url, previous_current_avatar_thumbnail_image_url';

const feed = {
    addGPSToDatabase(entry) {
        sqliteService.executeNonQuery(
            `INSERT OR IGNORE INTO ${dbVars.userPrefix}_feed_gps (created_at, user_id, display_name, location, world_name, previous_location, time, group_name) VALUES (@created_at, @user_id, @display_name, @location, @world_name, @previous_location, @time, @group_name)`,
            {
                '@created_at': entry.created_at,
                '@user_id': entry.userId,
                '@display_name': entry.displayName,
                '@location': entry.location,
                '@world_name': entry.worldName,
                '@previous_location': entry.previousLocation,
                '@time': entry.time,
                '@group_name': entry.groupName
            }
        );
    },

    addStatusToDatabase(entry) {
        sqliteService.executeNonQuery(
            `INSERT OR IGNORE INTO ${dbVars.userPrefix}_feed_status (created_at, user_id, display_name, status, status_description, previous_status, previous_status_description) VALUES (@created_at, @user_id, @display_name, @status, @status_description, @previous_status, @previous_status_description)`,
            {
                '@created_at': entry.created_at,
                '@user_id': entry.userId,
                '@display_name': entry.displayName,
                '@status': entry.status,
                '@status_description': entry.statusDescription,
                '@previous_status': entry.previousStatus,
                '@previous_status_description': entry.previousStatusDescription
            }
        );
    },

    addBioToDatabase(entry) {
        sqliteService.executeNonQuery(
            `INSERT OR IGNORE INTO ${dbVars.userPrefix}_feed_bio (created_at, user_id, display_name, bio, previous_bio) VALUES (@created_at, @user_id, @display_name, @bio, @previous_bio)`,
            {
                '@created_at': entry.created_at,
                '@user_id': entry.userId,
                '@display_name': entry.displayName,
                '@bio': entry.bio,
                '@previous_bio': entry.previousBio
            }
        );
    },

    async getLastBioChangeForUser(userId) {
        let result = null;
        await sqliteService.execute(
            (row) => {
                result = {
                    bio: row[0],
                    previousBio: row[1],
                    createdAt: row[2]
                };
            },
            `SELECT bio, previous_bio, created_at FROM ${dbVars.userPrefix}_feed_bio WHERE user_id = @userId ORDER BY id DESC LIMIT 1`,
            {
                '@userId': userId
            }
        );
        return result;
    },

    async searchBiosByContent(query, limit = 10) {
        const results = [];
        const searchLike = `%${query}%`;
        await sqliteService.execute(
            (row) => {
                results.push({
                    userId: row[0],
                    displayName: row[1],
                    bio: row[2]
                });
            },
            `SELECT fb.user_id, fb.display_name, fb.bio FROM ${dbVars.userPrefix}_feed_bio fb
             WHERE fb.id IN (SELECT MAX(id) FROM ${dbVars.userPrefix}_feed_bio GROUP BY user_id)
             AND fb.bio LIKE @searchLike
             LIMIT @limit`,
            {
                '@searchLike': searchLike,
                '@limit': limit
            }
        );
        return results;
    },

    async getLastStatusChangeForUser(userId) {
        let result = null;
        await sqliteService.execute(
            (row) => {
                result = {
                    status: row[0],
                    statusDescription: row[1],
                    previousStatus: row[2],
                    previousStatusDescription: row[3],
                    createdAt: row[4]
                };
            },
            `SELECT status, status_description, previous_status, previous_status_description, created_at FROM ${dbVars.userPrefix}_feed_status WHERE user_id = @userId ORDER BY id DESC LIMIT 1`,
            {
                '@userId': userId
            }
        );
        return result;
    },

    async getRecentBioChangesForUser(userId, limit = 50) {
        const results = [];
        await sqliteService.execute(
            (row) => {
                results.push({
                    bio: row[0],
                    previousBio: row[1],
                    createdAt: row[2]
                });
            },
            `SELECT bio, previous_bio, created_at FROM ${dbVars.userPrefix}_feed_bio WHERE user_id = @userId ORDER BY id DESC LIMIT @limit`,
            {
                '@userId': userId,
                '@limit': limit
            }
        );
        return results;
    },

    addAvatarToDatabase(entry) {
        sqliteService.executeNonQuery(
            `INSERT OR IGNORE INTO ${dbVars.userPrefix}_feed_avatar (created_at, user_id, display_name, owner_id, avatar_name, current_avatar_image_url, current_avatar_thumbnail_image_url, previous_current_avatar_image_url, previous_current_avatar_thumbnail_image_url) VALUES (@created_at, @user_id, @display_name, @owner_id, @avatar_name, @current_avatar_image_url, @current_avatar_thumbnail_image_url, @previous_current_avatar_image_url, @previous_current_avatar_thumbnail_image_url)`,
            {
                '@created_at': entry.created_at,
                '@user_id': entry.userId,
                '@display_name': entry.displayName,
                '@owner_id': entry.ownerId,
                '@avatar_name': entry.avatarName,
                '@current_avatar_image_url': entry.currentAvatarImageUrl,
                '@current_avatar_thumbnail_image_url':
                    entry.currentAvatarThumbnailImageUrl,
                '@previous_current_avatar_image_url':
                    entry.previousCurrentAvatarImageUrl,
                '@previous_current_avatar_thumbnail_image_url':
                    entry.previousCurrentAvatarThumbnailImageUrl
            }
        );
    },

    /**
     * Purges avatar feed data from the database.
     * !!!!
     * @param {string|null} cutoffDate - ISO date string. Deletes records older than this date. If null, deletes all records.
     */
    async purgeAvatarFeedData(cutoffDate) {
        if (cutoffDate) {
            await sqliteService.executeNonQuery(
                `DELETE FROM ${dbVars.userPrefix}_feed_avatar WHERE created_at < @cutoff`,
                {
                    '@cutoff': cutoffDate
                }
            );
        } else {
            await sqliteService.executeNonQuery(
                `DELETE FROM ${dbVars.userPrefix}_feed_avatar`
            );
        }
    },

    addOnlineOfflineToDatabase(entry) {
        sqliteService.executeNonQuery(
            `INSERT OR IGNORE INTO ${dbVars.userPrefix}_feed_online_offline (created_at, user_id, display_name, type, location, world_name, time, group_name) VALUES (@created_at, @user_id, @display_name, @type, @location, @world_name, @time, @group_name)`,
            {
                '@created_at': entry.created_at,
                '@user_id': entry.userId,
                '@display_name': entry.displayName,
                '@type': entry.type,
                '@location': entry.location,
                '@world_name': entry.worldName,
                '@time': entry.time,
                '@group_name': entry.groupName
            }
        );
    },

    /**
     * Returns all status change records for a specific user, ordered by time.
     * Used to build the status distribution chart in the user dialog.
     *
     * @param {string} userId
     * @returns {Promise<Array<{createdAt: string, status: string}>>}
     */
    async getStatusHistoryForUser(userId) {
        const results = [];
        await sqliteService.execute(
            (row) => {
                results.push({
                    createdAt: row[0],
                    status: row[1]
                });
            },
            `SELECT created_at, status FROM ${dbVars.userPrefix}_feed_status WHERE user_id = @userId ORDER BY created_at ASC`,
            { '@userId': userId }
        );
        return results;
    },

    /**
     * Returns all online/offline records for a specific user, ordered by time.
     * Used to calculate actual duration spent in each status.
     *
     * @param {string} userId
     * @returns {Promise<Array<{createdAt: string, type: 'Online'|'Offline'}>>}
     */
    async getOnlineOfflineHistoryForUser(userId) {
        const results = [];
        await sqliteService.execute(
            (row) => {
                results.push({
                    createdAt: row[0],
                    type: row[1]
                });
            },
            `SELECT created_at, type FROM ${dbVars.userPrefix}_feed_online_offline WHERE user_id = @userId ORDER BY created_at ASC`,
            { '@userId': userId }
        );
        return results;
    },

    /**
     * Returns the most recent timestamp at which a friend arrived at the given
     * location, as recorded in the GPS feed table.  Works for both real
     * instances and "private" / "private:private" locations.
     *
     * @param {string} userId
     * @param {string} location
     * @returns {Promise<number|null>} Unix timestamp (ms) or null
     */
    async getLastGPSArrivalTimeForUser(userId, location) {
        let arrivalTime = null;
        await sqliteService.execute(
            (row) => {
                const ts = Date.parse(row[0]);
                if (!isNaN(ts)) {
                    arrivalTime = ts;
                }
            },
            `SELECT created_at FROM ${dbVars.userPrefix}_feed_gps WHERE user_id = @userId AND location = @location ORDER BY id DESC LIMIT 1`,
            {
                '@userId': userId,
                '@location': location
            }
        );
        return arrivalTime;
    },

    async searchFeedDatabase(
        search,
        filters,
        vipList,
        maxEntries = dbVars.searchTableSize,
        dateFrom = '',
        dateTo = ''
    ) {
        // Guard against non-numeric values (e.g. an interop response envelope)
        // leaking into @limit/@perTable, which breaks SQLite with datatype mismatch.
        maxEntries = Number(maxEntries);
        if (!Number.isFinite(maxEntries)) maxEntries = dbVars.searchTableSize;
        if (!Number.isFinite(maxEntries)) maxEntries = DEFAULT_FEED_ENTRY_LIMIT;
        if (maxEntries < -1) maxEntries = -1;
        if (search.startsWith('wrld_') || search.startsWith('grp_')) {
            return this.getFeedByInstanceId(search, filters, vipList);
        }
        const { vipQuery, vipArgs } = buildVipQuery(vipList);
        let dateQuery = '';
        if (dateFrom) {
            dateQuery += 'AND created_at >= @dateFrom ';
        }
        if (dateTo) {
            dateQuery += 'AND created_at <= @dateTo ';
        }
        const { gps, status, bio, avatar, online, offline } =
            parseFeedFilters(filters);
        const aviPublic = search.includes('public');
        const aviPrivate = search.includes('private');
        const searchLike = `%${search}%`;
        const selects = [];

        if (gps) {
            selects.push(
                `SELECT * FROM (SELECT id, created_at, user_id, display_name, 'GPS' AS type, location, world_name, previous_location, time, group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, NULL AS bio, NULL AS previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url FROM ${dbVars.userPrefix}_feed_gps WHERE (display_name LIKE @searchLike OR world_name LIKE @searchLike OR group_name LIKE @searchLike) ${dateQuery} ${vipQuery} ORDER BY created_at DESC, id DESC LIMIT @perTable)`
            );
        }
        if (status) {
            selects.push(
                `SELECT * FROM (SELECT id, created_at, user_id, display_name, 'Status' AS type, NULL AS location, NULL AS world_name, NULL AS previous_location, NULL AS time, NULL AS group_name, status, status_description, previous_status, previous_status_description, NULL AS bio, NULL AS previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url FROM ${dbVars.userPrefix}_feed_status WHERE (display_name LIKE @searchLike OR status LIKE @searchLike OR status_description LIKE @searchLike) ${dateQuery} ${vipQuery} ORDER BY created_at DESC, id DESC LIMIT @perTable)`
            );
        }
        if (bio) {
            selects.push(
                `SELECT * FROM (SELECT id, created_at, user_id, display_name, 'Bio' AS type, NULL AS location, NULL AS world_name, NULL AS previous_location, NULL AS time, NULL AS group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, bio, previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url FROM ${dbVars.userPrefix}_feed_bio WHERE (display_name LIKE @searchLike OR bio LIKE @searchLike) ${dateQuery} ${vipQuery} ORDER BY created_at DESC, id DESC LIMIT @perTable)`
            );
        }
        if (avatar) {
            let avatarQuery = '';
            if (aviPrivate) {
                avatarQuery = 'OR user_id = owner_id';
            } else if (aviPublic) {
                avatarQuery = 'OR user_id != owner_id';
            }
            selects.push(
                `SELECT * FROM (SELECT id, created_at, user_id, display_name, 'Avatar' AS type, NULL AS location, NULL AS world_name, NULL AS previous_location, NULL AS time, NULL AS group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, NULL AS bio, NULL AS previous_bio, owner_id, avatar_name, current_avatar_image_url, current_avatar_thumbnail_image_url, previous_current_avatar_image_url, previous_current_avatar_thumbnail_image_url FROM ${dbVars.userPrefix}_feed_avatar WHERE (display_name LIKE @searchLike OR avatar_name LIKE @searchLike) ${avatarQuery} ${dateQuery} ${vipQuery} ORDER BY created_at DESC, id DESC LIMIT @perTable)`
            );
        }
        if (online || offline) {
            let query = '';
            if (!online || !offline) {
                if (online) {
                    query = "AND type = 'Online'";
                } else if (offline) {
                    query = "AND type = 'Offline'";
                }
            }
            selects.push(
                `SELECT * FROM (SELECT id, created_at, user_id, display_name, type, location, world_name, NULL AS previous_location, time, group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, NULL AS bio, NULL AS previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url FROM ${dbVars.userPrefix}_feed_online_offline WHERE (display_name LIKE @searchLike OR world_name LIKE @searchLike OR group_name LIKE @searchLike) ${query} ${dateQuery} ${vipQuery} ORDER BY created_at DESC, id DESC LIMIT @perTable)`
            );
        }
        if (selects.length === 0) {
            return [];
        }
        const feedDatabase = [];
        const args = {
            '@searchLike': searchLike,
            '@limit': maxEntries,
            '@perTable': maxEntries,
            ...vipArgs
        };
        if (dateFrom) {
            args['@dateFrom'] = dateFrom;
        }
        if (dateTo) {
            args['@dateTo'] = dateTo;
        }
        await sqliteService.execute(
            (dbRow) => {
                const type = dbRow[4];
                const row = {
                    rowId: dbRow[0],
                    created_at: dbRow[1],
                    userId: dbRow[2],
                    displayName: dbRow[3],
                    type
                };
                switch (type) {
                    case 'GPS':
                        row.location = dbRow[5];
                        row.worldName = dbRow[6];
                        row.previousLocation = dbRow[7];
                        row.time = dbRow[8];
                        row.groupName = dbRow[9];
                        break;
                    case 'Status':
                        row.status = dbRow[10];
                        row.statusDescription = dbRow[11];
                        row.previousStatus = dbRow[12];
                        row.previousStatusDescription = dbRow[13];
                        break;
                    case 'Bio':
                        row.bio = dbRow[14];
                        row.previousBio = dbRow[15];
                        break;
                    case 'Avatar':
                        row.ownerId = dbRow[16];
                        row.avatarName = dbRow[17];
                        row.currentAvatarImageUrl = dbRow[18];
                        row.currentAvatarThumbnailImageUrl = dbRow[19];
                        row.previousCurrentAvatarImageUrl = dbRow[20];
                        row.previousCurrentAvatarThumbnailImageUrl = dbRow[21];
                        break;
                    case 'Online':
                    case 'Offline':
                        row.location = dbRow[5];
                        row.worldName = dbRow[6];
                        row.time = dbRow[8];
                        row.groupName = dbRow[9];
                        break;
                }
                feedDatabase.push(row);
            },
            `SELECT ${BASE_COLUMNS} FROM (${selects.join(' UNION ALL ')}) ORDER BY created_at DESC, id DESC LIMIT @limit`,
            args
        );
        return feedDatabase;
    },

    async lookupFeedDatabase(
        filters,
        vipList,
        maxEntries = dbVars.maxTableSize
    ) {
        // Guard against non-numeric values (e.g. an interop response envelope)
        // leaking into @limit/@perTable, which breaks SQLite with datatype mismatch.
        maxEntries = Number(maxEntries);
        if (!Number.isFinite(maxEntries)) maxEntries = dbVars.maxTableSize;
        if (!Number.isFinite(maxEntries)) maxEntries = DEFAULT_FEED_ENTRY_LIMIT;
        if (maxEntries < -1) maxEntries = -1;
        const { vipQuery, vipArgs } = buildVipQuery(vipList);
        const { gps, status, bio, avatar, online, offline } =
            parseFeedFilters(filters);
        const selects = [];

        if (gps) {
            selects.push(
                `SELECT * FROM (SELECT id, created_at, user_id, display_name, 'GPS' AS type, location, world_name, previous_location, time, group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, NULL AS bio, NULL AS previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url FROM ${dbVars.userPrefix}_feed_gps WHERE 1=1 ${vipQuery} ORDER BY id DESC LIMIT @perTable)`
            );
        }
        if (status) {
            selects.push(
                `SELECT * FROM (SELECT id, created_at, user_id, display_name, 'Status' AS type, NULL AS location, NULL AS world_name, NULL AS previous_location, NULL AS time, NULL AS group_name, status, status_description, previous_status, previous_status_description, NULL AS bio, NULL AS previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url FROM ${dbVars.userPrefix}_feed_status WHERE 1=1 ${vipQuery} ORDER BY id DESC LIMIT @perTable)`
            );
        }
        if (bio) {
            selects.push(
                `SELECT * FROM (SELECT id, created_at, user_id, display_name, 'Bio' AS type, NULL AS location, NULL AS world_name, NULL AS previous_location, NULL AS time, NULL AS group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, bio, previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url FROM ${dbVars.userPrefix}_feed_bio WHERE 1=1 ${vipQuery} ORDER BY id DESC LIMIT @perTable)`
            );
        }
        if (avatar) {
            selects.push(
                `SELECT * FROM (SELECT id, created_at, user_id, display_name, 'Avatar' AS type, NULL AS location, NULL AS world_name, NULL AS previous_location, NULL AS time, NULL AS group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, NULL AS bio, NULL AS previous_bio, owner_id, avatar_name, current_avatar_image_url, current_avatar_thumbnail_image_url, previous_current_avatar_image_url, previous_current_avatar_thumbnail_image_url FROM ${dbVars.userPrefix}_feed_avatar WHERE 1=1 ${vipQuery} ORDER BY id DESC LIMIT @perTable)`
            );
        }
        if (online || offline) {
            let query = '';
            if (!online || !offline) {
                if (online) {
                    query = "AND type = 'Online'";
                } else if (offline) {
                    query = "AND type = 'Offline'";
                }
            }
            selects.push(
                `SELECT * FROM (SELECT id, created_at, user_id, display_name, type, location, world_name, NULL AS previous_location, time, group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, NULL AS bio, NULL AS previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url FROM ${dbVars.userPrefix}_feed_online_offline WHERE 1=1 ${query} ${vipQuery} ORDER BY id DESC LIMIT @perTable)`
            );
        }
        if (selects.length === 0) {
            return [];
        }
        const feedDatabase = [];
        const args = {
            '@limit': maxEntries,
            '@perTable': maxEntries,
            ...vipArgs
        };
        await sqliteService.execute(
            (dbRow) => {
                const type = dbRow[4];
                const row = {
                    rowId: dbRow[0],
                    created_at: dbRow[1],
                    userId: dbRow[2],
                    displayName: dbRow[3],
                    type
                };
                switch (type) {
                    case 'GPS':
                        row.location = dbRow[5];
                        row.worldName = dbRow[6];
                        row.previousLocation = dbRow[7];
                        row.time = dbRow[8];
                        row.groupName = dbRow[9];
                        break;
                    case 'Status':
                        row.status = dbRow[10];
                        row.statusDescription = dbRow[11];
                        row.previousStatus = dbRow[12];
                        row.previousStatusDescription = dbRow[13];
                        break;
                    case 'Bio':
                        row.bio = dbRow[14];
                        row.previousBio = dbRow[15];
                        break;
                    case 'Avatar':
                        row.ownerId = dbRow[16];
                        row.avatarName = dbRow[17];
                        row.currentAvatarImageUrl = dbRow[18];
                        row.currentAvatarThumbnailImageUrl = dbRow[19];
                        row.previousCurrentAvatarImageUrl = dbRow[20];
                        row.previousCurrentAvatarThumbnailImageUrl = dbRow[21];
                        break;
                    case 'Online':
                    case 'Offline':
                        row.location = dbRow[5];
                        row.worldName = dbRow[6];
                        row.time = dbRow[8];
                        row.groupName = dbRow[9];
                        break;
                }
                feedDatabase.push(row);
            },
            `SELECT ${BASE_COLUMNS} FROM (${selects.join(' UNION ALL ')}) ORDER BY created_at DESC, id DESC LIMIT @limit`,
            args
        );
        return feedDatabase;
    },

    async getFeedByInstanceId(instanceId, filters, vipList) {
        const { vipQuery, vipArgs } = buildVipQuery(vipList);
        let gps = true;
        let online = true;
        let offline = true;
        if (filters.length > 0) {
            gps = false;
            online = false;
            offline = false;
            filters.forEach((filter) => {
                switch (filter) {
                    case 'GPS':
                        gps = true;
                        break;
                    case 'Online':
                        online = true;
                        break;
                    case 'Offline':
                        offline = true;
                        break;
                }
            });
        }
        const selects = [];

        if (gps) {
            selects.push(
                `SELECT * FROM (SELECT id, created_at, user_id, display_name, 'GPS' AS type, location, world_name, previous_location, time, group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, NULL AS bio, NULL AS previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url FROM ${dbVars.userPrefix}_feed_gps WHERE location LIKE @instanceLike ${vipQuery} ORDER BY created_at DESC, id DESC LIMIT @perTable)`
            );
        }
        if (online || offline) {
            let query = '';
            if (!online || !offline) {
                if (online) {
                    query = "AND type = 'Online'";
                } else if (offline) {
                    query = "AND type = 'Offline'";
                }
            }
            selects.push(
                `SELECT * FROM (SELECT id, created_at, user_id, display_name, type, location, world_name, NULL AS previous_location, time, group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, NULL AS bio, NULL AS previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url FROM ${dbVars.userPrefix}_feed_online_offline WHERE location LIKE @instanceLike ${query} ${vipQuery} ORDER BY created_at DESC, id DESC LIMIT @perTable)`
            );
        }
        if (selects.length === 0) {
            return [];
        }
        const feedDatabase = [];
        const args = {
            '@instanceLike': `%${instanceId}%`,
            '@limit': dbVars.searchTableSize,
            '@perTable': dbVars.searchTableSize,
            ...vipArgs
        };
        await sqliteService.execute(
            (dbRow) => {
                const type = dbRow[4];
                const row = {
                    rowId: dbRow[0],
                    created_at: dbRow[1],
                    userId: dbRow[2],
                    displayName: dbRow[3],
                    type
                };
                switch (type) {
                    case 'GPS':
                        row.location = dbRow[5];
                        row.worldName = dbRow[6];
                        row.previousLocation = dbRow[7];
                        row.time = dbRow[8];
                        row.groupName = dbRow[9];
                        break;
                    case 'Online':
                    case 'Offline':
                        row.location = dbRow[5];
                        row.worldName = dbRow[6];
                        row.time = dbRow[8];
                        row.groupName = dbRow[9];
                        break;
                }
                feedDatabase.push(row);
            },
            `SELECT ${BASE_COLUMNS} FROM (${selects.join(' UNION ALL ')}) ORDER BY created_at DESC, id DESC LIMIT @limit`,
            args
        );
        return feedDatabase;
    },

    /**
     * @param {number} days - Number of days to look back
     * @param {number} limit - Max number of worlds to return
     * @returns {Promise<Array>} Ranked list of hot worlds
     */
    async getHotWorlds(days = 30, limit = 30) {
        if (!dbVars.userPrefix) {
            return [];
        }
        const halfDays = Math.floor(days / 2);
        const results = [];
        await sqliteService.execute(
            (dbRow) => {
                results.push({
                    worldId: dbRow[0],
                    worldName: dbRow[1],
                    visitCount: dbRow[2],
                    uniqueFriends: dbRow[3],
                    lastVisited: dbRow[4]
                });
            },
            `SELECT
                SUBSTR(location, 1, INSTR(location, ':') - 1) AS world_id,
                world_name,
                COUNT(*) AS visit_count,
                COUNT(DISTINCT user_id) AS unique_friends,
                MAX(created_at) AS last_visited
            FROM ${dbVars.userPrefix}_feed_gps
            WHERE created_at >= datetime('now', @daysOffset)
                AND location LIKE 'wrld_%'
                AND INSTR(location, ':') > 0
                AND world_name IS NOT NULL AND world_name != ''
            GROUP BY world_id
            ORDER BY unique_friends DESC, visit_count DESC
            LIMIT @limit`,
            {
                '@daysOffset': `-${days} days`,
                '@limit': limit
            }
        );

        const trendMap = new Map();
        await sqliteService.execute(
            (dbRow) => {
                trendMap.set(dbRow[0], dbRow[1]);
            },
            `SELECT
                SUBSTR(location, 1, INSTR(location, ':') - 1) AS world_id,
                COUNT(DISTINCT user_id) AS unique_friends
            FROM ${dbVars.userPrefix}_feed_gps
            WHERE created_at >= datetime('now', @daysOffset)
                AND created_at < datetime('now', @halfOffset)
                AND location LIKE 'wrld_%'
                AND INSTR(location, ':') > 0
                AND world_name IS NOT NULL AND world_name != ''
            GROUP BY world_id`,
            {
                '@daysOffset': `-${days} days`,
                '@halfOffset': `-${halfDays} days`
            }
        );

        const recentMap = new Map();
        await sqliteService.execute(
            (dbRow) => {
                recentMap.set(dbRow[0], dbRow[1]);
            },
            `SELECT
                SUBSTR(location, 1, INSTR(location, ':') - 1) AS world_id,
                COUNT(DISTINCT user_id) AS unique_friends
            FROM ${dbVars.userPrefix}_feed_gps
            WHERE created_at >= datetime('now', @halfOffset)
                AND location LIKE 'wrld_%'
                AND INSTR(location, ':') > 0
                AND world_name IS NOT NULL AND world_name != ''
            GROUP BY world_id`,
            {
                '@halfOffset': `-${halfDays} days`
            }
        );

        for (const world of results) {
            const oldFriends = trendMap.get(world.worldId) || 0;
            const newFriends = recentMap.get(world.worldId) || 0;
            if (newFriends > oldFriends) {
                world.trend = 'rising';
            } else if (newFriends < oldFriends) {
                world.trend = 'cooling';
            } else {
                world.trend = 'stable';
            }
        }

        return results;
    },

    /**
     * @param {string} worldId - The world ID (e.g. wrld_xxx)
     * @param {number} days - Number of days to look back
     * @returns {Promise<Array>} List of friends who visited
     */
    async getHotWorldFriendDetail(worldId, days = 30) {
        if (!dbVars.userPrefix) {
            return [];
        }
        const results = [];
        await sqliteService.execute(
            (dbRow) => {
                results.push({
                    userId: dbRow[0],
                    displayName: dbRow[1],
                    visitCount: dbRow[2],
                    lastVisit: dbRow[3]
                });
            },
            `SELECT
                user_id,
                display_name,
                COUNT(*) AS visit_count,
                MAX(created_at) AS last_visit
            FROM ${dbVars.userPrefix}_feed_gps
            WHERE SUBSTR(location, 1, INSTR(location, ':') - 1) = @worldId
                AND created_at >= datetime('now', @daysOffset)
            GROUP BY user_id
            ORDER BY visit_count DESC`,
            {
                '@worldId': worldId,
                '@daysOffset': `-${days} days`
            }
        );
        return results;
    },

    /**
     * @param {string} worldId - The world ID (e.g. wrld_xxx)
     * @param {number} days - Number of days to look back
     * @returns {Promise<Array>} Daily visit counts for the world
     */
    async getWorldVisitTrend(worldId, days = 30) {
        if (!dbVars.userPrefix) {
            return [];
        }
        const results = [];
        await sqliteService.execute(
            (dbRow) => {
                results.push({
                    date: dbRow[0],
                    visitCount: dbRow[1],
                    uniqueFriends: dbRow[2]
                });
            },
            `SELECT
                DATE(created_at) AS date,
                COUNT(*) AS visit_count,
                COUNT(DISTINCT user_id) AS unique_friends
            FROM ${dbVars.userPrefix}_feed_gps
            WHERE SUBSTR(location, 1, INSTR(location, ':') - 1) = @worldId
                AND created_at >= datetime('now', @daysOffset)
                AND location LIKE 'wrld_%'
            GROUP BY DATE(created_at)
            ORDER BY date ASC`,
            {
                '@worldId': worldId,
                '@daysOffset': `-${days} days`
            }
        );
        return results;
    },

    /**
     * @param {number} days - Number of days to look back
     * @param {number} limit - Max number of avatars to return
     * @returns {Promise<Object>} Avatar usage statistics
     */
    async getAvatarUsageStats(days = 30, limit = 50) {
        if (!dbVars.userPrefix) {
            return {
                topAvatars: [],
                selfVsOther: { selfOwned: 0, others: 0 },
                totalChanges: 0,
                dailyChanges: [],
                topAuthors: [],
                topUsers: [],
                dailyByUser: [],
                avatarUserMap: {}
            };
        }
        const topAvatars = [];
        await sqliteService.execute(
            (dbRow) => {
                topAvatars.push({
                    avatarName: dbRow[0],
                    ownerId: dbRow[1],
                    changeCount: dbRow[2],
                    uniqueUsers: dbRow[3],
                    lastUsed: dbRow[4]
                });
            },
            `SELECT
                avatar_name,
                owner_id,
                COUNT(*) AS change_count,
                COUNT(DISTINCT user_id) AS unique_users,
                MAX(created_at) AS last_used
            FROM ${dbVars.userPrefix}_feed_avatar
            WHERE created_at >= datetime('now', @daysOffset)
                AND avatar_name IS NOT NULL AND avatar_name != ''
            GROUP BY avatar_name, owner_id
            ORDER BY change_count DESC
            LIMIT @limit`,
            {
                '@daysOffset': `-${days} days`,
                '@limit': limit
            }
        );

        const selfVsOther = { selfOwned: 0, others: 0 };
        await sqliteService.execute(
            (dbRow) => {
                if (dbRow[0] === dbRow[1]) {
                    selfVsOther.selfOwned = dbRow[2];
                } else {
                    selfVsOther.others = dbRow[2];
                }
            },
            `SELECT
                user_id,
                owner_id,
                COUNT(*) AS change_count
            FROM ${dbVars.userPrefix}_feed_avatar
            WHERE created_at >= datetime('now', @daysOffset)
                AND avatar_name IS NOT NULL AND avatar_name != ''
            GROUP BY user_id, owner_id`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        let totalChanges = 0;
        await sqliteService.execute(
            (dbRow) => {
                totalChanges = dbRow[0] || 0;
            },
            `SELECT COUNT(*) FROM ${dbVars.userPrefix}_feed_avatar
            WHERE created_at >= datetime('now', @daysOffset)
                AND avatar_name IS NOT NULL AND avatar_name != ''`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        const dailyChanges = [];
        await sqliteService.execute(
            (dbRow) => {
                dailyChanges.push({
                    date: dbRow[0],
                    count: dbRow[1]
                });
            },
            `SELECT
                DATE(created_at) AS date,
                COUNT(*) AS count
            FROM ${dbVars.userPrefix}_feed_avatar
            WHERE created_at >= datetime('now', @daysOffset)
                AND avatar_name IS NOT NULL AND avatar_name != ''
            GROUP BY DATE(created_at)
            ORDER BY date ASC`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        const topAuthors = [];
        await sqliteService.execute(
            (dbRow) => {
                topAuthors.push({
                    ownerId: dbRow[0],
                    avatarCount: dbRow[1],
                    changeCount: dbRow[2]
                });
            },
            `SELECT
                owner_id,
                COUNT(DISTINCT avatar_name) AS avatar_count,
                COUNT(*) AS change_count
            FROM ${dbVars.userPrefix}_feed_avatar
            WHERE created_at >= datetime('now', @daysOffset)
                AND avatar_name IS NOT NULL AND avatar_name != ''
            GROUP BY owner_id
            ORDER BY change_count DESC
            LIMIT 10`,
            {
                '@daysOffset': `-${days} days`
            }
        );


        const topUsers = [];
        await sqliteService.execute(
            (dbRow) => {
                topUsers.push({
                    displayName: dbRow[0],
                    changeCount: dbRow[1],
                    uniqueAvatars: dbRow[2]
                });
            },
            `SELECT
                display_name,
                COUNT(*) AS change_count,
                COUNT(DISTINCT avatar_name) AS unique_avatars
            FROM ${dbVars.userPrefix}_feed_avatar
            WHERE created_at >= datetime('now', @daysOffset)
                AND avatar_name IS NOT NULL AND avatar_name != ''
            GROUP BY user_id
            ORDER BY change_count DESC
            LIMIT 10`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        const dailyByUser = [];
        await sqliteService.execute(
            (dbRow) => {
                dailyByUser.push({
                    displayName: dbRow[0],
                    date: dbRow[1],
                    count: dbRow[2]
                });
            },
            `SELECT
                display_name,
                DATE(created_at) AS date,
                COUNT(*) AS count
            FROM ${dbVars.userPrefix}_feed_avatar
            WHERE created_at >= datetime('now', @daysOffset)
                AND avatar_name IS NOT NULL AND avatar_name != ''
            GROUP BY user_id, DATE(created_at)
            ORDER BY date ASC`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        const avatarUserMap = {};
        await sqliteService.execute(
            (dbRow) => {
                const avatarName = dbRow[0];
                const displayName = dbRow[1];
                const count = dbRow[2];
                if (!avatarUserMap[avatarName]) {
                    avatarUserMap[avatarName] = [];
                }
                avatarUserMap[avatarName].push({ displayName, count });
            },
            `SELECT
                avatar_name,
                display_name,
                COUNT(*) AS change_count
            FROM ${dbVars.userPrefix}_feed_avatar
            WHERE created_at >= datetime('now', @daysOffset)
                AND avatar_name IS NOT NULL AND avatar_name != ''
            GROUP BY avatar_name, user_id
            ORDER BY avatar_name, change_count DESC`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        return {
            topAvatars,
            selfVsOther,
            totalChanges,
            dailyChanges,
            topAuthors,
            topUsers,
            dailyByUser,
            avatarUserMap
        };
    },

    /**
     * @param {number} days - Number of days to look back
     * @returns {Promise<Array>} Daily avatar change counts
     */
    async getAvatarChangeTimeline(days = 30) {
        if (!dbVars.userPrefix) {
            return [];
        }
        const results = [];
        await sqliteService.execute(
            (dbRow) => {
                results.push({
                    date: dbRow[0],
                    count: dbRow[1],
                    uniqueUsers: dbRow[2]
                });
            },
            `SELECT
                DATE(created_at) AS date,
                COUNT(*) AS count,
                COUNT(DISTINCT user_id) AS unique_users
            FROM ${dbVars.userPrefix}_feed_avatar
            WHERE created_at >= datetime('now', @daysOffset)
                AND avatar_name IS NOT NULL AND avatar_name != ''
            GROUP BY DATE(created_at)
            ORDER BY date ASC`,
            {
                '@daysOffset': `-${days} days`
            }
        );
        return results;
    },
    /**
     * @param {number} days - Number of days to look back
     * @param {number} limit - Max number of avatars
     * @returns {Promise<Object>} Avatar usage with per-friend details
     */
    async getAvatarUsageWithDetails(days = 30, limit = 30) {
        if (!dbVars.userPrefix) {
            return { topAvatars: [], avatarUserMap: {} };
        }
        const topAvatars = [];
        await sqliteService.execute(
            (dbRow) => {
                topAvatars.push({
                    avatarName: dbRow[0],
                    ownerId: dbRow[1],
                    changeCount: dbRow[2],
                    uniqueUsers: dbRow[3],
                    lastUsed: dbRow[4]
                });
            },
            `SELECT
                avatar_name,
                owner_id,
                COUNT(*) AS change_count,
                COUNT(DISTINCT user_id) AS unique_users,
                MAX(created_at) AS last_used
            FROM ${dbVars.userPrefix}_feed_avatar
            WHERE created_at >= datetime('now', @daysOffset)
                AND avatar_name IS NOT NULL AND avatar_name != ''
            GROUP BY avatar_name, owner_id
            ORDER BY change_count DESC
            LIMIT @limit`,
            {
                '@daysOffset': `-${days} days`,
                '@limit': limit
            }
        );

        const avatarUserMap = {};
        await sqliteService.execute(
            (dbRow) => {
                const avatarName = dbRow[0];
                const displayName = dbRow[1];
                const count = dbRow[2];
                if (!avatarUserMap[avatarName]) {
                    avatarUserMap[avatarName] = [];
                }
                avatarUserMap[avatarName].push({ displayName, count });
            },
            `SELECT
                avatar_name,
                display_name,
                COUNT(*) AS change_count
            FROM ${dbVars.userPrefix}_feed_avatar
            WHERE created_at >= datetime('now', @daysOffset)
                AND avatar_name IS NOT NULL AND avatar_name != ''
            GROUP BY avatar_name, user_id
            ORDER BY avatar_name, change_count DESC`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        return { topAvatars, avatarUserMap };
    },

    /**
     * @param {number} days - Number of days to look back
     * @returns {Promise<Object>} Friend activity summary
     */
    async getFriendActivitySummary(days = 30) {
        if (!dbVars.userPrefix) {
            return { totalVisits: 0, uniqueFriends: 0, uniqueWorlds: 0, topFriends: [] };
        }
        let totalVisits = 0;
        let uniqueFriends = 0;
        let uniqueWorlds = 0;
        await sqliteService.execute(
            (dbRow) => {
                totalVisits = dbRow[0] || 0;
                uniqueFriends = dbRow[1] || 0;
                uniqueWorlds = dbRow[2] || 0;
            },
            `SELECT
                COUNT(*) AS total_visits,
                COUNT(DISTINCT user_id) AS unique_friends,
                COUNT(DISTINCT SUBSTR(location, 1, INSTR(location, ':') - 1)) AS unique_worlds
            FROM ${dbVars.userPrefix}_feed_gps
            WHERE created_at >= datetime('now', @daysOffset)
                AND location LIKE 'wrld_%' AND INSTR(location, ':') > 0`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        const topFriends = [];
        await sqliteService.execute(
            (dbRow) => {
                topFriends.push({
                    displayName: dbRow[0],
                    visitCount: dbRow[1],
                    uniqueWorlds: dbRow[2]
                });
            },
            `SELECT
                display_name,
                COUNT(*) AS visit_count,
                COUNT(DISTINCT SUBSTR(location, 1, INSTR(location, ':') - 1)) AS unique_worlds
            FROM ${dbVars.userPrefix}_feed_gps
            WHERE created_at >= datetime('now', @daysOffset)
                AND location LIKE 'wrld_%' AND INSTR(location, ':') > 0
            GROUP BY user_id
            ORDER BY visit_count DESC
            LIMIT 10`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        return { totalVisits, uniqueFriends, uniqueWorlds, topFriends };
    },

    /**
     * @param {number} days - Number of days to look back
     * @returns {Promise<Object>} Status change summary
     */
    async getStatusChangeSummary(days = 30) {
        if (!dbVars.userPrefix) {
            return { totalChanges: 0, topStatuses: [], uniqueUsers: 0, topUsers: [], dailyByUser: [] };
        }
        let totalChanges = 0;
        let uniqueUsers = 0;
        await sqliteService.execute(
            (dbRow) => {
                totalChanges = dbRow[0] || 0;
                uniqueUsers = dbRow[1] || 0;
            },
            `SELECT
                COUNT(*) AS total_changes,
                COUNT(DISTINCT user_id) AS unique_users
            FROM ${dbVars.userPrefix}_feed_status
            WHERE created_at >= datetime('now', @daysOffset)`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        const topStatuses = [];
        await sqliteService.execute(
            (dbRow) => {
                topStatuses.push({
                    status: dbRow[0],
                    statusDescription: dbRow[1],
                    changeCount: dbRow[2]
                });
            },
            `SELECT
                status,
                status_description,
                COUNT(*) AS change_count
            FROM ${dbVars.userPrefix}_feed_status
            WHERE created_at >= datetime('now', @daysOffset)
                AND status IS NOT NULL AND status != ''
            GROUP BY status, status_description
            ORDER BY change_count DESC
            LIMIT 10`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        const topUsers = [];
        await sqliteService.execute(
            (dbRow) => {
                topUsers.push({
                    displayName: dbRow[0],
                    changeCount: dbRow[1]
                });
            },
            `SELECT
                display_name,
                COUNT(*) AS change_count
            FROM ${dbVars.userPrefix}_feed_status
            WHERE created_at >= datetime('now', @daysOffset)
            GROUP BY user_id
            ORDER BY change_count DESC
            LIMIT 10`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        const dailyByUser = [];
        await sqliteService.execute(
            (dbRow) => {
                dailyByUser.push({
                    displayName: dbRow[0],
                    date: dbRow[1],
                    count: dbRow[2]
                });
            },
            `SELECT
                display_name,
                DATE(created_at) AS date,
                COUNT(*) AS count
            FROM ${dbVars.userPrefix}_feed_status
            WHERE created_at >= datetime('now', @daysOffset)
            GROUP BY user_id, DATE(created_at)
            ORDER BY date ASC`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        return { totalChanges, topStatuses, uniqueUsers, topUsers, dailyByUser };
    },

    /**
     * @param {number} days - Number of days to look back
     * @returns {Promise<Object>} Online activity summary
     */
    async getOnlineActivitySummary(days = 30) {
        if (!dbVars.userPrefix) {
            return { onlineCount: 0, offlineCount: 0, topOnlineFriends: [], dailyByUser: [] };
        }
        let onlineCount = 0;
        let offlineCount = 0;
        await sqliteService.execute(
            (dbRow) => {
                if (dbRow[0] === 'online') onlineCount = dbRow[1] || 0;
                if (dbRow[0] === 'offline') offlineCount = dbRow[1] || 0;
            },
            `SELECT
                type,
                COUNT(*) AS count
            FROM ${dbVars.userPrefix}_feed_online_offline
            WHERE created_at >= datetime('now', @daysOffset)
            GROUP BY type`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        const topOnlineFriends = [];
        await sqliteService.execute(
            (dbRow) => {
                topOnlineFriends.push({
                    displayName: dbRow[0],
                    onlineCount: dbRow[1]
                });
            },
            `SELECT
                display_name,
                COUNT(*) AS online_count
            FROM ${dbVars.userPrefix}_feed_online_offline
            WHERE created_at >= datetime('now', @daysOffset)
                AND type = 'online'
            GROUP BY user_id
            ORDER BY online_count DESC
            LIMIT 10`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        const dailyByUser = [];
        await sqliteService.execute(
            (dbRow) => {
                dailyByUser.push({
                    displayName: dbRow[0],
                    date: dbRow[1],
                    count: dbRow[2]
                });
            },
            `SELECT
                display_name,
                DATE(created_at) AS date,
                COUNT(*) AS count
            FROM ${dbVars.userPrefix}_feed_online_offline
            WHERE created_at >= datetime('now', @daysOffset)
                AND type = 'online'
            GROUP BY user_id, DATE(created_at)
            ORDER BY date ASC`,
            {
                '@daysOffset': `-${days} days`
            }
        );

        return { onlineCount, offlineCount, topOnlineFriends, dailyByUser };
    }
};

export { feed };
