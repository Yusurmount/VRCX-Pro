<template>
    <Dialog v-model:open="visible">
        <DialogContent class="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{{ t('view.settings.notifications.custom_rules.title') }}</DialogTitle>
                <DialogDescription>
                    {{ t('view.settings.notifications.custom_rules.description') }}
                </DialogDescription>
            </DialogHeader>

            <div class="flex flex-col gap-4">
                <div class="flex gap-2">
                    <Select v-model-value="newRuleType" :placeholder="t('view.settings.notifications.custom_rules.select_type')">
                        <SelectTrigger class="flex-1">
                            <SelectValue :placeholder="t('view.settings.notifications.custom_rules.select_type')" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="rt in ruleTypes" :key="rt.value" :value="rt.value">
                                {{ rt.label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" @click="addNewRule" :disabled="!newRuleType">
                        <Plus class="h-4 w-4" />
                    </Button>
                </div>

                <div v-if="rules.length === 0" class="text-sm text-muted-foreground text-center py-4">
                    {{ t('view.settings.notifications.custom_rules.no_rules') }}
                </div>

                <div v-for="rule in rules" :key="rule.id"
                     class="border rounded-lg p-3 flex flex-col gap-2">
                    <div class="flex items-center gap-2">
                        <Switch :model-value="rule.enabled" @update:model-value="toggleRule(rule.id)" />
                        <input
                            v-model="rule.name"
                            class="flex-1 bg-transparent border-b border-transparent hover:border-border focus:border-border outline-none text-sm font-medium"
                            :placeholder="getRuleTypeLabel(rule.type)"
                            @change="saveRule(rule)" />
                        <Button size="sm" variant="ghost" @click="removeRule(rule.id)">
                            <Trash2 class="h-4 w-4 text-destructive" />
                        </Button>
                    </div>

                    <div class="text-xs text-muted-foreground">
                        {{ t('view.settings.notifications.custom_rules.type') }}: {{ getRuleTypeLabel(rule.type) }}
                    </div>

                    <!-- Friend Online/Offline target -->
                    <div v-if="rule.type === 'friend_online' || rule.type === 'friend_offline'"
                         class="flex flex-col gap-1">
                        <label class="text-xs text-muted-foreground">
                            {{ t('view.settings.notifications.custom_rules.target_user_id') }}
                        </label>
                        <input
                            v-model="rule.targetUserId"
                            class="text-sm bg-background border rounded px-2 py-1"
                            :placeholder="t('view.settings.notifications.custom_rules.user_id_placeholder')"
                            @change="saveRule(rule)" />
                        <input
                            v-model="rule.targetDisplayName"
                            class="text-sm bg-background border rounded px-2 py-1"
                            :placeholder="t('view.settings.notifications.custom_rules.display_name_placeholder')"
                            @change="saveRule(rule)" />
                    </div>

                    <!-- World target -->
                    <div v-if="rule.type === 'world_entered' || rule.type === 'world_empty'"
                         class="flex flex-col gap-1">
                        <label class="text-xs text-muted-foreground">
                            {{ t('view.settings.notifications.custom_rules.world_id') }}
                        </label>
                        <input
                            v-model="rule.worldId"
                            class="text-sm bg-background border rounded px-2 py-1"
                            :placeholder="t('view.settings.notifications.custom_rules.world_id_placeholder')"
                            @change="saveRule(rule)" />
                        <input
                            v-model="rule.worldName"
                            class="text-sm bg-background border rounded px-2 py-1"
                            :placeholder="t('view.settings.notifications.custom_rules.world_name_placeholder')"
                            @change="saveRule(rule)" />
                        <div v-if="rule.type === 'world_entered'" class="flex items-center gap-2">
                            <label class="text-xs text-muted-foreground">
                                {{ t('view.settings.notifications.custom_rules.min_players') }}
                            </label>
                            <input
                                v-model.number="rule.minPlayerCount"
                                type="number"
                                min="0"
                                class="w-20 text-sm bg-background border rounded px-2 py-1"
                                @change="saveRule(rule)" />
                        </div>
                    </div>

                    <!-- Avatar target -->
                    <div v-if="rule.type === 'avatar_deleted'"
                         class="flex flex-col gap-1">
                        <label class="text-xs text-muted-foreground">
                            {{ t('view.settings.notifications.custom_rules.avatar_id') }}
                        </label>
                        <input
                            v-model="rule.avatarId"
                            class="text-sm bg-background border rounded px-2 py-1"
                            :placeholder="t('view.settings.notifications.custom_rules.avatar_id_placeholder')"
                            @change="saveRule(rule)" />
                        <input
                            v-model="rule.avatarName"
                            class="text-sm bg-background border rounded px-2 py-1"
                            :placeholder="t('view.settings.notifications.custom_rules.avatar_name_placeholder')"
                            @change="saveRule(rule)" />
                    </div>

                    <!-- Status Change target -->
                    <div v-if="rule.type === 'status_change'"
                         class="flex flex-col gap-1">
                        <label class="text-xs text-muted-foreground">
                            {{ t('view.settings.notifications.custom_rules.target_user_id') }}
                        </label>
                        <input
                            v-model="rule.targetUserId"
                            class="text-sm bg-background border rounded px-2 py-1"
                            :placeholder="t('view.settings.notifications.custom_rules.user_id_placeholder')"
                            @change="saveRule(rule)" />
                        <input
                            v-model="rule.targetDisplayName"
                            class="text-sm bg-background border rounded px-2 py-1"
                            :placeholder="t('view.settings.notifications.custom_rules.display_name_placeholder')"
                            @change="saveRule(rule)" />
                    </div>

                    <!-- Cooldown -->
                    <div class="flex items-center gap-2">
                        <label class="text-xs text-muted-foreground">
                            {{ t('view.settings.notifications.custom_rules.cooldown') }}
                        </label>
                        <input
                            v-model.number="rule.cooldownSeconds"
                            type="number"
                            min="0"
                            class="w-20 text-sm bg-background border rounded px-2 py-1"
                            @change="saveRule(rule)" />
                        <span class="text-xs text-muted-foreground">sec</span>
                    </div>

                    <!-- Notification channels -->
                    <div class="flex items-center gap-3">
                        <label class="text-xs text-muted-foreground">
                            {{ t('view.settings.notifications.custom_rules.channels') }}:
                        </label>
                        <label class="flex items-center gap-1 text-xs">
                            <Checkbox :model-value="rule.channels?.desktopToast"
                                @update:model-value="(v) => { rule.channels.desktopToast = v; saveRule(rule); }" />
                            {{ t('view.settings.notifications.custom_rules.channel_desktop') }}
                        </label>
                        <label class="flex items-center gap-1 text-xs">
                            <Checkbox :model-value="rule.channels?.tts"
                                @update:model-value="(v) => { rule.channels.tts = v; saveRule(rule); }" />
                            {{ t('view.settings.notifications.custom_rules.channel_tts') }}
                        </label>
                        <label class="flex items-center gap-1 text-xs">
                            <Checkbox :model-value="rule.channels?.email"
                                @update:model-value="(v) => { rule.channels.email = v; saveRule(rule); }" />
                            {{ t('view.settings.notifications.custom_rules.channel_email') }}
                        </label>
                    </div>
                </div>
            </div>

            <DialogFooter>
                <Button size="sm" variant="outline" @click="visible = false">
                    {{ t('dialog.close') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Plus, Trash2 } from 'lucide-vue-next';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useNotificationRulesStore, RULE_TYPES, createDefaultRule } from '@/stores/notificationRules';

const { t } = useI18n();
const notificationRulesStore = useNotificationRulesStore();

const visible = defineModel('visible', { type: Boolean, default: false });

const newRuleType = ref('');
const rules = computed(() => notificationRulesStore.rules);
const ruleTypes = RULE_TYPES;

function getRuleTypeLabel(type) {
    const found = ruleTypes.find((rt) => rt.value === type);
    return found ? found.label : type;
}

function addNewRule() {
    if (!newRuleType.value) return;
    const rule = createDefaultRule(newRuleType.value);
    rule.name = getRuleTypeLabel(newRuleType.value);
    notificationRulesStore.addRule(rule);
    newRuleType.value = '';
}

function saveRule(rule) {
    notificationRulesStore.updateRule(rule);
}

function removeRule(ruleId) {
    notificationRulesStore.removeRule(ruleId);
}

function toggleRule(ruleId) {
    notificationRulesStore.toggleRule(ruleId);
}
</script>
