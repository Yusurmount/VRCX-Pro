import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import configRepository from '../../services/config';

export const useEmailNotificationsSettingsStore = defineStore(
    'EmailNotificationsSettings',
    () => {
        const { t } = useI18n();

        const enabled = ref(false);
        const smtpHost = ref('');
        const smtpPort = ref(465);
        const smtpUseSsl = ref(true);
        const smtpUsername = ref('');
        const smtpPassword = ref('');
        const smtpFromAddress = ref('');
        const smtpFromName = ref('VRCX-Pro');
        const recipientAddress = ref('');
        const recipientName = ref('');

        async function initEmailSettings() {
            const [
                enabledConfig,
                smtpHostConfig,
                smtpPortConfig,
                smtpUseSslConfig,
                smtpUsernameConfig,
                smtpPasswordConfig,
                smtpFromAddressConfig,
                smtpFromNameConfig,
                recipientAddressConfig,
                recipientNameConfig
            ] = await Promise.all([
                configRepository.getBool('VRCX_emailNotificationsEnabled', false),
                configRepository.getString('VRCX_smtpHost', ''),
                configRepository.getString('VRCX_smtpPort', '465'),
                configRepository.getBool('VRCX_smtpUseSsl', true),
                configRepository.getString('VRCX_smtpUsername', ''),
                configRepository.getString('VRCX_smtpPassword', ''),
                configRepository.getString('VRCX_smtpFromAddress', ''),
                configRepository.getString('VRCX_smtpFromName', 'VRCX-Pro'),
                configRepository.getString('VRCX_emailRecipientAddress', ''),
                configRepository.getString('VRCX_emailRecipientName', '')
            ]);

            enabled.value = enabledConfig;
            smtpHost.value = smtpHostConfig;
            smtpPort.value = parseInt(smtpPortConfig, 10) || 465;
            smtpUseSsl.value = smtpUseSslConfig;
            smtpUsername.value = smtpUsernameConfig;
            smtpPassword.value = smtpPasswordConfig;
            smtpFromAddress.value = smtpFromAddressConfig;
            smtpFromName.value = smtpFromNameConfig;
            recipientAddress.value = recipientAddressConfig;
            recipientName.value = recipientNameConfig;
        }

        async function setEnabled(value) {
            enabled.value = value;
            await configRepository.setBool('VRCX_emailNotificationsEnabled', value);
        }

        async function setSmtpHost(value) {
            smtpHost.value = value;
            await configRepository.setString('VRCX_smtpHost', value);
        }

        async function setSmtpPort(value) {
            smtpPort.value = value;
            await configRepository.setString('VRCX_smtpPort', String(value));
        }

        async function setSmtpUseSsl(value) {
            smtpUseSsl.value = value;
            await configRepository.setBool('VRCX_smtpUseSsl', value);
        }

        async function setSmtpUsername(value) {
            smtpUsername.value = value;
            await configRepository.setString('VRCX_smtpUsername', value);
        }

        async function setSmtpPassword(value) {
            smtpPassword.value = value;
            await configRepository.setString('VRCX_smtpPassword', value);
        }

        async function setSmtpFromAddress(value) {
            smtpFromAddress.value = value;
            await configRepository.setString('VRCX_smtpFromAddress', value);
        }

        async function setSmtpFromName(value) {
            smtpFromName.value = value;
            await configRepository.setString('VRCX_smtpFromName', value);
        }

        async function setRecipientAddress(value) {
            recipientAddress.value = value;
            await configRepository.setString('VRCX_emailRecipientAddress', value);
        }

        async function setRecipientName(value) {
            recipientName.value = value;
            await configRepository.setString('VRCX_emailRecipientName', value);
        }

        function getConfig() {
            return {
                enabled: enabled.value,
                smtpHost: smtpHost.value,
                smtpPort: smtpPort.value,
                smtpUseSsl: smtpUseSsl.value,
                smtpUsername: smtpUsername.value,
                smtpPassword: smtpPassword.value,
                smtpFromAddress: smtpFromAddress.value,
                smtpFromName: smtpFromName.value,
                recipientAddress: recipientAddress.value,
                recipientName: recipientName.value
            };
        }

        function isConfigured() {
            return (
                enabled.value &&
                smtpHost.value &&
                smtpPort.value &&
                smtpFromAddress.value &&
                recipientAddress.value
            );
        }

        return {
            enabled,
            smtpHost,
            smtpPort,
            smtpUseSsl,
            smtpUsername,
            smtpPassword,
            smtpFromAddress,
            smtpFromName,
            recipientAddress,
            recipientName,
            initEmailSettings,
            setEnabled,
            setSmtpHost,
            setSmtpPort,
            setSmtpUseSsl,
            setSmtpUsername,
            setSmtpPassword,
            setSmtpFromAddress,
            setSmtpFromName,
            setRecipientAddress,
            setRecipientName,
            getConfig,
            isConfigured
        };
    }
);
