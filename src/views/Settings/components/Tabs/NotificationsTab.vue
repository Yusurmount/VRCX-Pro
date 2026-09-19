<template>
    <div class="flex flex-col gap-10 py-2">
        <SettingsGroup :title="t('view.settings.notifications.notifications.header')">
            <SettingsItem :label="t('view.settings.notifications.notifications.layout')">
                <Select :model-value="notificationLayout" @update:modelValue="setNotificationLayout">
                    <SelectTrigger size="sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="notification-center">{{
                            t('view.settings.notifications.notifications.layout_notification_center')
                        }}</SelectItem>
                        <SelectItem value="table">{{
                            t('view.settings.notifications.notifications.layout_table')
                        }}</SelectItem>
                    </SelectContent>
                </Select>
            </SettingsItem>

            <SettingsItem :label="t('view.settings.notifications.notifications.notification_filter')">
                <Button size="sm" variant="outline" @click="showNotyFeedFiltersDialog">{{
                    t('view.settings.notifications.notifications.notification_filter')
                }}</Button>
            </SettingsItem>

            <SettingsItem :label="t('view.settings.notifications.notifications.test_notification')">
                <Button size="sm" variant="outline" @click="testNotification"
                    ><Play />{{ t('view.settings.notifications.notifications.test_notification') }}</Button
                >
            </SettingsItem>
        </SettingsGroup>

        <SettingsGroup :title="t('view.settings.notifications.notifications.desktop_notifications.header')">
            <SettingsItem :label="t('view.settings.notifications.notifications.desktop_notifications.when_to_display')">
                <ToggleGroup
                    type="single"
                    required
                    variant="outline"
                    size="sm"
                    :model-value="desktopToast"
                    @update:model-value="setDesktopToast(String($event))">
                    <ToggleGroupItem value="Never">{{
                        t('view.settings.notifications.notifications.conditions.never')
                    }}</ToggleGroupItem>
                    <ToggleGroupItem value="Desktop Mode">{{
                        t('view.settings.notifications.notifications.conditions.desktop')
                    }}</ToggleGroupItem>
                    <ToggleGroupItem value="Inside VR">{{
                        t('view.settings.notifications.notifications.conditions.inside_vr')
                    }}</ToggleGroupItem>
                    <ToggleGroupItem value="Outside VR">{{
                        t('view.settings.notifications.notifications.conditions.outside_vr')
                    }}</ToggleGroupItem>
                    <ToggleGroupItem value="Game Running">{{
                        t('view.settings.notifications.notifications.conditions.inside_vrchat')
                    }}</ToggleGroupItem>
                    <ToggleGroupItem value="Game Closed">{{
                        t('view.settings.notifications.notifications.conditions.outside_vrchat')
                    }}</ToggleGroupItem>
                    <ToggleGroupItem value="Always">{{
                        t('view.settings.notifications.notifications.conditions.always')
                    }}</ToggleGroupItem>
                </ToggleGroup>
            </SettingsItem>

            <SettingsItem
                :label="
                    t('view.settings.notifications.notifications.desktop_notifications.desktop_notification_while_afk')
                ">
                <Switch
                    :model-value="afkDesktopToast"
                    :ariaLabel="
                        t(
                            'view.settings.notifications.notifications.desktop_notifications.desktop_notification_while_afk'
                        )
                    "
                    @update:modelValue="setAfkDesktopToast" />
            </SettingsItem>
        </SettingsGroup>

        <SettingsGroup :title="t('view.settings.notifications.notifications.text_to_speech.header')">
            <SettingsItem :label="t('view.settings.notifications.notifications.text_to_speech.when_to_play')">
                <ToggleGroup
                    type="single"
                    required
                    variant="outline"
                    size="sm"
                    :model-value="notificationTTS"
                    @update:model-value="saveNotificationTTS">
                    <ToggleGroupItem value="Never">{{
                        t('view.settings.notifications.notifications.conditions.never')
                    }}</ToggleGroupItem>
                    <ToggleGroupItem value="Inside VR">{{
                        t('view.settings.notifications.notifications.conditions.inside_vr')
                    }}</ToggleGroupItem>
                    <ToggleGroupItem value="Game Running">{{
                        t('view.settings.notifications.notifications.conditions.inside_vrchat')
                    }}</ToggleGroupItem>
                    <ToggleGroupItem value="Game Closed">{{
                        t('view.settings.notifications.notifications.conditions.outside_vrchat')
                    }}</ToggleGroupItem>
                    <ToggleGroupItem value="Always">{{
                        t('view.settings.notifications.notifications.conditions.always')
                    }}</ToggleGroupItem>
                </ToggleGroup>
            </SettingsItem>

            <SettingsItem :label="t('view.settings.notifications.notifications.text_to_speech.tts_voice')">
                <Select
                    :model-value="ttsVoiceIndex"
                    :disabled="notificationTTS === 'Never'"
                    @update:modelValue="(v) => (ttsVoiceIndex = v)">
                    <SelectTrigger size="sm">
                        <SelectValue :placeholder="getTTSVoiceName()" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectItem v-for="(voice, index) in TTSvoices" :key="index" :value="index">
                                {{ voice.name }}
                            </SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </SettingsItem>

            <SettingsItem :label="t('view.settings.notifications.notifications.text_to_speech.use_memo_nicknames')">
                <Switch
                    :model-value="notificationTTSNickName"
                    :disabled="notificationTTS === 'Never'"
                    :ariaLabel="t('view.settings.notifications.notifications.text_to_speech.use_memo_nicknames')"
                    @update:modelValue="setNotificationTTSNickName" />
            </SettingsItem>

            <SettingsItem :label="t('view.settings.notifications.notifications.text_to_speech.tts_test_placeholder')">
                <Switch
                    :model-value="isTestTTSVisible"
                    :ariaLabel="t('view.settings.notifications.notifications.text_to_speech.tts_test_placeholder')"
                    @update:modelValue="isTestTTSVisible = !isTestTTSVisible" />
            </SettingsItem>

            <div v-if="isTestTTSVisible" class="flex items-center gap-2 mt-1">
                <InputGroupTextareaField
                    v-model="notificationTTSTest"
                    :placeholder="t('view.settings.notifications.notifications.text_to_speech.tts_test_placeholder')"
                    :rows="1"
                    class="w-44"
                    input-class="resize-none min-h-0" />
                <Button size="sm" variant="outline" @click="testNotificationTTS">{{
                    t('view.settings.notifications.notifications.text_to_speech.play')
                }}</Button>
            </div>
        </SettingsGroup>

        <SettingsGroup :title="t('view.settings.notifications.custom_rules.header')">
            <SettingsItem
                :label="t('view.settings.notifications.custom_rules.manage')"
                :description="t('view.settings.notifications.custom_rules.manage_description')">
                <Button size="sm" variant="outline" @click="notificationRulesDialogVisible = true">
                    {{ t('view.settings.notifications.custom_rules.manage_button') }}
                    <span v-if="customRulesCount > 0" class="ml-1 text-xs text-muted-foreground">
                        ({{ customRulesCount }})
                    </span>
                </Button>
            </SettingsItem>
        </SettingsGroup>

        <SettingsGroup :title="t('view.settings.notifications.email.header')">
            <SettingsItem
                :label="t('view.settings.notifications.email.enable')"
                :description="t('view.settings.notifications.email.enable_description')">
                <Switch
                    :model-value="emailEnabled"
                    @update:modelValue="emailStore.setEnabled" />
            </SettingsItem>

            <template v-if="emailEnabled">
                <SettingsItem :label="t('view.settings.notifications.email.smtp_host')">
                    <input
                        v-model="emailSmtpHost"
                        class="text-sm bg-background border rounded px-2 py-1 w-48"
                        :placeholder="t('view.settings.notifications.email.smtp_host_placeholder')"
                        @change="emailStore.setSmtpHost(emailSmtpHost)" />
                </SettingsItem>

                <SettingsItem :label="t('view.settings.notifications.email.smtp_port')">
                    <input
                        v-model.number="emailSmtpPort"
                        type="number"
                        class="text-sm bg-background border rounded px-2 py-1 w-20"
                        @change="emailStore.setSmtpPort(emailSmtpPort)" />
                </SettingsItem>

                <SettingsItem :label="t('view.settings.notifications.email.smtp_ssl')">
                    <Switch
                        :model-value="emailSmtpUseSsl"
                        @update:modelValue="emailStore.setSmtpUseSsl" />
                </SettingsItem>

                <SettingsItem :label="t('view.settings.notifications.email.smtp_username')">
                    <input
                        v-model="emailSmtpUsername"
                        class="text-sm bg-background border rounded px-2 py-1 w-48"
                        :placeholder="t('view.settings.notifications.email.smtp_username_placeholder')"
                        @change="emailStore.setSmtpUsername(emailSmtpUsername)" />
                </SettingsItem>

                <SettingsItem :label="t('view.settings.notifications.email.smtp_password')">
                    <input
                        v-model="emailSmtpPassword"
                        type="password"
                        class="text-sm bg-background border rounded px-2 py-1 w-48"
                        :placeholder="t('view.settings.notifications.email.smtp_password_placeholder')"
                        @change="emailStore.setSmtpPassword(emailSmtpPassword)" />
                </SettingsItem>

                <SettingsItem :label="t('view.settings.notifications.email.from_address')">
                    <input
                        v-model="emailSmtpFromAddress"
                        class="text-sm bg-background border rounded px-2 py-1 w-48"
                        :placeholder="t('view.settings.notifications.email.from_address_placeholder')"
                        @change="emailStore.setSmtpFromAddress(emailSmtpFromAddress)" />
                </SettingsItem>

                <SettingsItem :label="t('view.settings.notifications.email.from_name')">
                    <input
                        v-model="emailSmtpFromName"
                        class="text-sm bg-background border rounded px-2 py-1 w-48"
                        @change="emailStore.setSmtpFromName(emailSmtpFromName)" />
                </SettingsItem>

                <SettingsItem :label="t('view.settings.notifications.email.recipient_address')">
                    <input
                        v-model="emailRecipientAddress"
                        class="text-sm bg-background border rounded px-2 py-1 w-48"
                        :placeholder="t('view.settings.notifications.email.recipient_address_placeholder')"
                        @change="emailStore.setRecipientAddress(emailRecipientAddress)" />
                </SettingsItem>

                <SettingsItem :label="t('view.settings.notifications.email.recipient_name')">
                    <input
                        v-model="emailRecipientName"
                        class="text-sm bg-background border rounded px-2 py-1 w-48"
                        @change="emailStore.setRecipientName(emailRecipientName)" />
                </SettingsItem>

                <SettingsItem :label="t('view.settings.notifications.email.test')">
                    <Button size="sm" variant="outline" @click="testEmail" :disabled="isEmailSending">
                        <Play class="h-4 w-4" />
                        {{ isEmailSending ? t('view.settings.notifications.email.sending') : t('view.settings.notifications.email.send_test') }}
                    </Button>
                </SettingsItem>
            </template>
        </SettingsGroup>

        <FeedFiltersDialog v-model:feedFiltersDialogMode="feedFiltersDialogMode" />
        <NotificationRulesDialog v-model:visible="notificationRulesDialogVisible" />
    </div>
</template>

<script setup>
    import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
    import { Switch } from '@/components/ui/switch';
    import { computed, onMounted, ref } from 'vue';
    import { Button } from '@/components/ui/button';
    import { InputGroupTextareaField } from '@/components/ui/input-group';
    import { Play } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { toast } from 'vue-sonner';
    import { useI18n } from 'vue-i18n';

    import {
        useNotificationStore,
        useNotificationsSettingsStore,
        useNotificationRulesStore,
        useEmailNotificationsSettingsStore
    } from '@/stores';

    import FeedFiltersDialog from '../../dialogs/FeedFiltersDialog.vue';
    import NotificationRulesDialog from '../../dialogs/NotificationRulesDialog.vue';
    import SettingsGroup from '../SettingsGroup.vue';
    import SettingsItem from '../SettingsItem.vue';

    const { t } = useI18n();

    const notificationsSettingsStore = useNotificationsSettingsStore();
    const notificationRulesStore = useNotificationRulesStore();
    const emailStore = useEmailNotificationsSettingsStore();

    const {
        desktopToast,
        afkDesktopToast,
        notificationTTS,
        notificationTTSNickName,
        isTestTTSVisible,
        notificationTTSTest,
        TTSvoices,
        notificationLayout
    } = storeToRefs(notificationsSettingsStore);

    const {
        setDesktopToast,
        setAfkDesktopToast,
        setNotificationTTSNickName,
        getTTSVoiceName,
        changeTTSVoice,
        saveNotificationTTS,
        testNotificationTTS,
        setNotificationLayout
    } = notificationsSettingsStore;

    const { testNotification, markAllAsSeen } = useNotificationStore();

    const feedFiltersDialogMode = ref('');
    const notificationRulesDialogVisible = ref(false);
    const customRulesCount = computed(() => notificationRulesStore.rules.length);

    // Email settings
    const emailEnabled = computed(() => emailStore.enabled);
    const emailSmtpHost = ref(emailStore.smtpHost);
    const emailSmtpPort = ref(emailStore.smtpPort);
    const emailSmtpUseSsl = computed(() => emailStore.smtpUseSsl);
    const emailSmtpUsername = ref(emailStore.smtpUsername);
    const emailSmtpPassword = ref(emailStore.smtpPassword);
    const emailSmtpFromAddress = ref(emailStore.smtpFromAddress);
    const emailSmtpFromName = ref(emailStore.smtpFromName);
    const emailRecipientAddress = ref(emailStore.recipientAddress);
    const emailRecipientName = ref(emailStore.recipientName);
    const isEmailSending = ref(false);

    const ttsVoiceIndex = computed({
        get: () => {
            const currentName = getTTSVoiceName();
            const idx = TTSvoices.value.findIndex((v) => v?.name === currentName);
            return idx >= 0 ? idx : null;
        },
        set: (value) => {
            if (typeof value === 'number') {
                changeTTSVoice(value);
            }
        }
    });

    onMounted(() => {
        markAllAsSeen();
        emailStore.initEmailSettings();
        notificationRulesStore.initRules();
    });

    function showNotyFeedFiltersDialog() {
        feedFiltersDialogMode.value = 'noty';
    }

    async function testEmail() {
        isEmailSending.value = true;
        try {
            const { sendEmail } = await import('@/services/emailNotification.js');
            const result = await sendEmail({
                subject: 'VRCX-Pro Test Notification',
                body: `This is a test email from VRCX-Pro.\n\nSent at: ${new Date().toLocaleString()}\n\nIf you received this, your email notification settings are configured correctly.`
            });
            if (result) {
                toast.success(t('view.settings.notifications.email.test_success'));
            } else {
                toast.error(t('view.settings.notifications.email.test_failed'));
            }
        } catch (err) {
            toast.error(t('view.settings.notifications.email.test_error'));
        } finally {
            isEmailSending.value = false;
        }
    }
</script>
