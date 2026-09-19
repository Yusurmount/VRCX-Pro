import { defineStore } from 'pinia';
import { ref } from 'vue';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';

import configRepository from '../services/config';
import { useFriendStore } from './friend';
import { useFavoriteStore } from './favorite';
import { useUserStore } from './user';
import { useNotificationsSettingsStore } from './settings/notifications';

let ruleIdCounter = 0;

function generateRuleId() {
    return `rule_${Date.now()}_${++ruleIdCounter}`;
}

export const RULE_TYPES = [
    { value: 'friend_online', label: 'Friend Online' },
    { value: 'friend_offline', label: 'Friend Offline' },
    { value: 'world_entered', label: 'World Entered' },
    { value: 'world_empty', label: 'World Empty' },
    { value: 'avatar_deleted', label: 'Avatar Deleted' },
    { value: 'status_change', label: 'Status Change' }
];

function createDefaultRule(type) {
    const base = {
        id: generateRuleId(),
        type,
        enabled: true,
        cooldownSeconds: 300,
        createdAt: new Date().toISOString(),
        channels: {
            desktopToast: true,
            tts: false,
            email: false
        }
    };
    switch (type) {
        case 'friend_online':
        case 'friend_offline':
            return { ...base, name: '', targetUserId: '', targetDisplayName: '' };
        case 'world_entered':
            return { ...base, name: '', worldId: '', worldName: '', minPlayerCount: 0 };
        case 'world_empty':
            return { ...base, name: '', worldId: '', worldName: '' };
        case 'avatar_deleted':
            return { ...base, name: '', avatarId: '', avatarName: '' };
        case 'status_change':
            return { ...base, name: '', targetUserId: '', targetDisplayName: '', fromStatus: '', toStatus: '' };
        default:
            return base;
    }
}

export { createDefaultRule };

export const useNotificationRulesStore = defineStore('NotificationRules', () => {
    const { t } = useI18n();
    const friendStore = useFriendStore();
    const favoriteStore = useFavoriteStore();
    const userStore = useUserStore();
    const notificationsSettingsStore = useNotificationsSettingsStore();

    const rules = ref([]);
    const lastTriggered = ref({});

    async function initRules() {
        const saved = await configRepository.getString('VRCX_notificationRules', '[]');
        try {
            rules.value = JSON.parse(saved);
        } catch {
            rules.value = [];
        }
    }

    async function saveRules() {
        await configRepository.setString('VRCX_notificationRules', JSON.stringify(rules.value));
    }

    function addRule(rule) {
        rules.value.push(rule);
        saveRules();
    }

    function updateRule(updatedRule) {
        const idx = rules.value.findIndex((r) => r.id === updatedRule.id);
        if (idx !== -1) {
            rules.value[idx] = { ...updatedRule };
            saveRules();
        }
    }

    function removeRule(ruleId) {
        rules.value = rules.value.filter((r) => r.id !== ruleId);
        delete lastTriggered.value[ruleId];
        saveRules();
    }

    function toggleRule(ruleId) {
        const rule = rules.value.find((r) => r.id === ruleId);
        if (rule) {
            rule.enabled = !rule.enabled;
            saveRules();
        }
    }

    function isOnCooldown(ruleId) {
        const last = lastTriggered.value[ruleId];
        if (!last) return false;
        const rule = rules.value.find((r) => r.id === ruleId);
        if (!rule) return false;
        return Date.now() - last < (rule.cooldownSeconds || 300) * 1000;
    }

    function markTriggered(ruleId) {
        lastTriggered.value[ruleId] = Date.now();
    }

    function evaluateRules(eventType, eventData) {
        const matchingRules = rules.value.filter((r) => r.enabled && r.type === eventType);
        for (const rule of matchingRules) {
            if (isOnCooldown(rule.id)) continue;
            let matches = false;
            let message = '';
            switch (rule.type) {
                case 'friend_online':
                    matches = rule.targetUserId === eventData.userId;
                    if (matches) message = `${rule.targetDisplayName || eventData.displayName || eventData.userId} is now online`;
                    break;
                case 'friend_offline':
                    matches = rule.targetUserId === eventData.userId;
                    if (matches) message = `${rule.targetDisplayName || eventData.displayName || eventData.userId} went offline`;
                    break;
                case 'world_entered': {
                    const eventWorldId = eventData.worldId || '';
                    matches = rule.worldId && eventWorldId.includes(rule.worldId);
                    if (matches && rule.minPlayerCount > 0) {
                        matches = (eventData.playerCount || 0) >= rule.minPlayerCount;
                    }
                    if (matches) message = `Player entered ${rule.worldName || rule.worldId}`;
                    break;
                }
                case 'world_empty': {
                    const emptyWorldId = eventData.worldId || '';
                    matches = rule.worldId && emptyWorldId.includes(rule.worldId) && (eventData.playerCount || 0) === 0;
                    if (matches) message = `${rule.worldName || rule.worldId} is now empty`;
                    break;
                }
                case 'avatar_deleted':
                    matches = rule.avatarId === eventData.avatarId;
                    if (matches) message = `Favorited avatar "${rule.avatarName || eventData.avatarName || rule.avatarId}" may have been deleted`;
                    break;
                case 'status_change':
                    matches = rule.targetUserId === eventData.userId;
                    if (matches) message = `${rule.targetDisplayName || eventData.displayName || eventData.userId}: ${eventData.fromStatus || '?'} -> ${eventData.toStatus || '?'}`;
                    break;
            }
            if (matches) {
                markTriggered(rule.id);
                triggerNotification(rule, message, eventData);
            }
        }
    }

    function triggerNotification(rule, message, eventData) {
        const title = rule.name || `[Rule] ${rule.type}`;
        if (rule.channels.desktopToast) {
            toast.info(`${title}: ${message}`);
        }
        if (rule.channels.tts) {
            notificationsSettingsStore.speak(`${title}, ${message}`);
        }
        if (rule.channels.email) {
            import('../services/emailNotification.js').then(({ sendRuleEmail }) => {
                sendRuleEmail(rule, message, eventData).catch((err) => {
                    console.error('Failed to send rule email:', err);
                });
            });
        }
    }

    return {
        rules,
        lastTriggered,
        initRules,
        saveRules,
        addRule,
        updateRule,
        removeRule,
        toggleRule,
        evaluateRules,
        isOnCooldown
    };
});
