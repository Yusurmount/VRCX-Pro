import { i18n } from '../plugins/i18n';
import { useModalStore } from '../stores';

// requires binding of SQLite
class SQLiteService {
    handleSQLiteError(e) {
        if (typeof e.message === 'string') {
            try {
                const modal = useModalStore();
                if (e.message.includes('database disk image is malformed')) {
                    modal.alert({
                        description:
                            'Your database file is corrupted. Please repair or delete your database file by renaming the "%AppData%\\VRCX" folder or deleting the database file to reset VRCX.',
                        title: 'Your database is corrupted'
                    }).catch(() => {});
                }
                if (e.message.includes('database or disk is full')) {
                    modal.alert({
                        description: i18n.global.t('message.database.disk_space'),
                        title: 'Disk containing database is full'
                    });
                }
                if (
                    e.message.includes('database is locked') ||
                    e.message.includes('attempt to write a readonly database')
                ) {
                    modal.alert({
                        description:
                            'Please close other applications that might be using the database file.',
                        title: 'Database is locked'
                    });
                }
                if (e.message.includes('disk I/O error')) {
                    modal.alert({
                        description: i18n.global.t('message.database.disk_error'),
                        title: 'Disk I/O error'
                    });
                }
            } catch {
                // Pinia not installed yet (e.g. during startup) — log instead
                console.error('[SQLite]', e.message);
            }
        }
        throw e;
    }

    async execute(callback, sql, args = null) {
        try {
            var data = await SQLite.Execute(sql, args);
            for (var i = 0, len = data.length; i < len; i++) {
                callback(data[i]);
            }
        } catch (e) {
            this.handleSQLiteError(e);
        }
    }

    async executeNonQuery(sql, args = null) {
        try {
            return await SQLite.ExecuteNonQuery(sql, args);
        } catch (e) {
            this.handleSQLiteError(e);
        }
    }
}

var self = new SQLiteService();
window.sqliteService = self;

export { self as default, SQLiteService };