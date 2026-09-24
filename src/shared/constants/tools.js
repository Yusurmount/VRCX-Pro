const toolCategories = [
    { key: 'image', labelKey: 'view.tools.pictures.header' },
    { key: 'shortcuts', labelKey: 'view.tools.shortcuts.header' },
    { key: 'group', labelKey: 'view.tools.group.header' },
    { key: 'system', labelKey: 'view.tools.system_tools.header' },
    { key: 'user', labelKey: 'view.tools.export.header' },
    { key: 'other', labelKey: 'view.tools.other.header' }
];

const toolDefinitions = [
    {
        key: 'screenshot-metadata',
        category: 'image',
        iconKey: 'camera',
        navIcon: 'ri-camera-line',
        titleKey: 'view.tools.pictures.screenshot',
        descriptionKey: 'view.tools.pictures.screenshot_description',
        navEligible: true,
        action: { type: 'route', routeName: 'screenshot-metadata' }
    },
    {
        key: 'gallery',
        category: 'image',
        iconKey: 'image',
        navIcon: 'ri-image-line',
        titleKey: 'view.tools.pictures.gallery',
        descriptionKey: 'view.tools.pictures.gallery_description',
        navEligible: true,
        action: { type: 'route', routeName: 'gallery' }
    },
    {
        key: 'vrc-photos',
        category: 'shortcuts',
        iconKey: 'folder-open',
        navIcon: 'ri-folder-image-line',
        titleKey: 'view.tools.pictures.pictures.vrc_photos',
        descriptionKey: 'view.tools.pictures.pictures.vrc_photos_description',
        navEligible: true,
        action: {
            type: 'app-api',
            method: 'OpenVrcPhotosFolder',
            successMessageKey: 'message.file.folder_opened',
            errorMessageKey: 'message.file.folder_missing'
        }
    },
    {
        key: 'steam-screenshots',
        category: 'shortcuts',
        iconKey: 'folder-image',
        navIcon: 'ri-folder-image-line',
        titleKey: 'view.tools.pictures.pictures.steam_screenshots',
        descriptionKey:
            'view.tools.pictures.pictures.steam_screenshots_description',
        navEligible: true,
        action: {
            type: 'app-api',
            method: 'OpenVrcScreenshotsFolder',
            successMessageKey: 'message.file.folder_opened',
            errorMessageKey: 'message.file.folder_missing'
        }
    },
    {
        key: 'vrcx-data',
        category: 'shortcuts',
        iconKey: 'folder-cog',
        navIcon: 'ri-folder-settings-line',
        titleKey: 'view.tools.shortcuts.vrcx_data',
        descriptionKey: 'view.tools.shortcuts.vrcx_data_description',
        navEligible: true,
        action: {
            type: 'app-api',
            method: 'OpenVrcxAppDataFolder',
            successMessageKey: 'message.file.folder_opened',
            errorMessageKey: 'message.file.folder_missing'
        }
    },
    {
        key: 'vrchat-data',
        category: 'shortcuts',
        iconKey: 'folder-cog',
        navIcon: 'ri-folder-settings-line',
        titleKey: 'view.tools.shortcuts.vrchat_data',
        descriptionKey: 'view.tools.shortcuts.vrchat_data_description',
        navEligible: true,
        action: {
            type: 'app-api',
            method: 'OpenVrcAppDataFolder',
            successMessageKey: 'message.file.folder_opened',
            errorMessageKey: 'message.file.folder_missing'
        }
    },
    {
        key: 'crash-dumps',
        category: 'shortcuts',
        iconKey: 'folder-x',
        navIcon: 'ri-folder-warning-line',
        titleKey: 'view.tools.shortcuts.crash_dumps',
        descriptionKey: 'view.tools.shortcuts.crash_dumps_description',
        navEligible: true,
        action: {
            type: 'app-api',
            method: 'OpenCrashVrcCrashDumps',
            successMessageKey: 'message.file.folder_opened',
            errorMessageKey: 'message.file.folder_missing'
        }
    },
    {
        key: 'vrchat-config',
        category: 'system',
        iconKey: 'sliders-horizontal',
        navIcon: 'ri-settings-3-line',
        titleKey: 'view.tools.system_tools.vrchat_config',
        descriptionKey: 'view.tools.system_tools.vrchat_config_description',
        navEligible: true,
        action: {
            type: 'store-action',
            target: 'advancedSettings',
            method: 'showVRChatConfig'
        }
    },
    {
        key: 'launch-options',
        category: 'system',
        iconKey: 'terminal',
        navIcon: 'ri-terminal-box-line',
        titleKey: 'view.settings.advanced.advanced.launch_options',
        descriptionKey: 'view.tools.system_tools.launch_options_description',
        navEligible: true,
        action: {
            type: 'store-action',
            target: 'launch',
            method: 'showLaunchOptions'
        }
    },
    {
        key: 'registry-backup',
        category: 'system',
        iconKey: 'archive',
        navIcon: 'ri-archive-stack-line',
        titleKey: 'view.settings.advanced.advanced.vrc_registry_backup',
        descriptionKey: 'view.tools.system_tools.registry_backup_description',
        navEligible: true,
        action: {
            type: 'store-action',
            target: 'vrcx',
            method: 'showRegistryBackupDialog'
        }
    },
    {
        key: 'auto-change-status',
        category: 'system',
        iconKey: 'bot',
        navIcon: 'ri-user-settings-line',
        titleKey: 'view.settings.general.automation.auto_change_status',
        descriptionKey:
            'view.settings.general.automation.auto_state_change_tooltip',
        navEligible: true,
        action: { type: 'dialog', dialogKey: 'auto-change-status' }
    },
    {
        key: 'database-management',
        category: 'system',
        iconKey: 'database',
        navIcon: 'ri-database-2-line',
        titleKey: 'view.settings.advanced.advanced.db_manage.button',
        descriptionKey: 'view.settings.advanced.advanced.db_manage.description',
        navEligible: true,
        action: { type: 'dialog', dialogKey: 'databaseManagement' }
    },
    {
        key: 'info-completion',
        category: 'system',
        iconKey: 'database',
        navIcon: 'ri-database-2-line',
        titleKey: 'view.tools.system_tools.info_completion',
        descriptionKey: 'view.tools.system_tools.info_completion_description',
        navEligible: true,
        action: { type: 'dialog', dialogKey: 'infoCompletion' }
    },
    {
        key: 'group-calendar',
        category: 'group',
        iconKey: 'calendar',
        navIcon: 'ri-calendar-event-line',
        titleKey: 'view.tools.group.calendar',
        descriptionKey: 'view.tools.group.calendar_description',
        navEligible: true,
        action: { type: 'dialog', dialogKey: 'group-calendar' }
    },
    {
        key: 'discord-names',
        category: 'user',
        iconKey: 'users',
        navIcon: 'ri-discord-line',
        titleKey: 'view.tools.export.discord_names',
        descriptionKey: 'view.tools.user.discord_names_description',
        navEligible: true,
        action: { type: 'dialog', dialogKey: 'export-discord-names' }
    },
    {
        key: 'export-notes',
        category: 'user',
        iconKey: 'file-text',
        navIcon: 'ri-file-list-3-line',
        titleKey: 'view.tools.export.export_notes',
        descriptionKey: 'view.tools.export.export_notes_description',
        navEligible: true,
        action: { type: 'dialog', dialogKey: 'note-export' }
    },
    {
        key: 'export-friend-list',
        category: 'user',
        iconKey: 'users',
        navIcon: 'ri-file-list-3-line',
        titleKey: 'view.tools.export.export_friend_list',
        descriptionKey: 'view.tools.user.export_friend_list_description',
        navEligible: true,
        action: { type: 'dialog', dialogKey: 'export-friends-list' }
    },
    {
        key: 'export-own-avatars',
        category: 'user',
        iconKey: 'download',
        navIcon: 'ri-file-list-3-line',
        titleKey: 'view.tools.export.export_own_avatars',
        descriptionKey: 'view.tools.user.export_own_avatars_description',
        navEligible: true,
        action: { type: 'dialog', dialogKey: 'export-avatars-list' }
    },
    {
        key: 'export-feed',
        category: 'user',
        iconKey: 'download',
        navIcon: 'ri-rss-line',
        titleKey: 'view.feed.header',
        descriptionKey: 'view.tools.user.export_feed_description',
        navEligible: false,
        action: { type: 'export', source: 'feed' }
    },
    {
        key: 'export-friend-log',
        category: 'user',
        iconKey: 'download',
        navIcon: 'ri-history-line',
        titleKey: 'view.friend_log.header',
        descriptionKey: 'view.tools.user.export_friend_log_description',
        navEligible: false,
        action: { type: 'export', source: 'friend-log' }
    },
    {
        key: 'export-friend-list-data',
        category: 'user',
        iconKey: 'download',
        navIcon: 'ri-contacts-line',
        titleKey: 'view.friend_list.header',
        descriptionKey: 'view.tools.user.export_friend_list_data_description',
        navEligible: false,
        action: { type: 'export', source: 'friend-list' }
    },
    {
        key: 'export-game-log',
        category: 'user',
        iconKey: 'download',
        navIcon: 'ri-file-list-3-line',
        titleKey: 'view.game_log.header',
        descriptionKey: 'view.tools.user.export_game_log_description',
        navEligible: false,
        action: { type: 'export', source: 'game-log' }
    },
    {
        key: 'export-moderation',
        category: 'user',
        iconKey: 'download',
        navIcon: 'ri-shield-user-line',
        titleKey: 'view.moderation.header',
        descriptionKey: 'view.tools.user.export_moderation_description',
        navEligible: false,
        action: { type: 'export', source: 'moderation-list' }
    },
    {
        key: 'export-notifications',
        category: 'user',
        iconKey: 'download',
        navIcon: 'ri-notification-2-line',
        titleKey: 'view.notification.header',
        descriptionKey: 'view.tools.user.export_notifications_description',
        navEligible: false,
        action: { type: 'export', source: 'notifications' }
    },
    {
        key: 'export-my-avatars',
        category: 'user',
        iconKey: 'download',
        navIcon: 'ri-user-star-line',
        titleKey: 'view.my_avatars.header',
        descriptionKey: 'view.tools.user.export_my_avatars_description',
        navEligible: false,
        action: { type: 'export', source: 'my-avatars' }
    },
    {
        key: 'export-favorite-worlds',
        category: 'user',
        iconKey: 'download',
        navIcon: 'ri-earth-line',
        titleKey: 'view.favorites.worlds',
        descriptionKey: 'view.tools.user.export_favorite_worlds_description',
        navEligible: false,
        action: { type: 'export', source: 'favorite-worlds' }
    },
    {
        key: 'export-favorite-friends',
        category: 'user',
        iconKey: 'download',
        navIcon: 'ri-user-heart-line',
        titleKey: 'view.favorites.friends',
        descriptionKey: 'view.tools.user.export_favorite_friends_description',
        navEligible: false,
        action: { type: 'export', source: 'favorite-friends' }
    },
    {
        key: 'export-favorite-avatars',
        category: 'user',
        iconKey: 'download',
        navIcon: 'ri-empathize-line',
        titleKey: 'view.favorites.avatars',
        descriptionKey: 'view.tools.user.export_favorite_avatars_description',
        navEligible: false,
        action: { type: 'export', source: 'favorite-avatars' }
    },
    {
        key: 'world-export',
        category: 'user',
        iconKey: 'download',
        navIcon: 'ri-file-download-line',
        titleKey: 'dialog.world_export.header',
        descriptionKey: 'view.tools.user.world_export_description',
        navEligible: false,
        action: { type: 'dialog', dialogKey: 'world-export' }
    },
    {
        key: 'avatar-export',
        category: 'user',
        iconKey: 'download',
        navIcon: 'ri-file-download-line',
        titleKey: 'dialog.avatar_export.header',
        descriptionKey: 'view.tools.user.avatar_export_description',
        navEligible: false,
        action: { type: 'dialog', dialogKey: 'avatar-export' }
    },
    {
        key: 'friend-export',
        category: 'user',
        iconKey: 'download',
        navIcon: 'ri-file-download-line',
        titleKey: 'dialog.friend_export.header',
        descriptionKey: 'view.tools.user.friend_export_description',
        navEligible: false,
        action: { type: 'dialog', dialogKey: 'friend-export' }
    },
    {
        key: 'edit-invite-message',
        category: 'other',
        iconKey: 'pencil',
        navIcon: 'ri-quill-pen-line',
        titleKey: 'view.tools.other.edit_invite_message',
        descriptionKey: 'view.tools.other.edit_invite_message_description',
        navEligible: true,
        action: { type: 'dialog', dialogKey: 'edit-invite-messages' }
    }
];

const toolDefinitionMap = new Map(
    toolDefinitions.map((tool) => [tool.key, tool])
);

const toolNavDefinitions = toolDefinitions
    .filter((tool) => tool.navEligible)
    .map((tool) => ({
        key: `tool-${tool.key}`,
        icon: tool.navIcon,
        tooltip: tool.titleKey,
        labelKey: tool.titleKey,
        routeName: tool.action.type === 'route' ? tool.action.routeName : null,
        action:
            tool.action.type === 'route'
                ? null
                : {
                      type: 'tool',
                      toolKey: tool.key
                  },
        defaultHidden: true
    }));

const defaultHiddenToolNavKeys = toolNavDefinitions.map((tool) => tool.key);
const isToolNavKey = (key) =>
    typeof key === 'string' && key.startsWith('tool-');

function getToolsByCategory(categoryKey) {
    return toolDefinitions.filter((tool) => tool.category === categoryKey);
}

export {
    defaultHiddenToolNavKeys,
    isToolNavKey,
    toolCategories,
    toolDefinitions,
    toolDefinitionMap,
    toolNavDefinitions,
    getToolsByCategory
};
