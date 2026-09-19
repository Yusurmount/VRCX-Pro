import { toast } from 'vue-sonner';
import { useEmailNotificationsSettingsStore } from '../stores/settings/emailNotifications';

/**
 * Send an email via the .NET sidecar SMTP handler.
 * @param {object} params
 * @param {string} params.subject
 * @param {string} params.body
 * @param {string} [params.recipientAddress]
 * @param {string} [params.recipientName]
 * @returns {Promise<boolean>}
 */
export async function sendEmail({ subject, body, recipientAddress, recipientName }) {
    const emailStore = useEmailNotificationsSettingsStore();
    const config = emailStore.getConfig();

    if (!config.enabled || !config.smtpHost) {
        console.warn('Email notifications are not configured');
        return false;
    }

    const to = recipientAddress || config.recipientAddress;
    const toName = recipientName || config.recipientName || '';

    if (!to) {
        console.warn('No recipient address configured');
        return false;
    }

    try {
        const result = await AppApi.SendEmail(JSON.stringify({
            smtpHost: config.smtpHost,
            smtpPort: config.smtpPort,
            smtpUseSsl: config.smtpUseSsl,
            smtpUsername: config.smtpUsername,
            smtpPassword: config.smtpPassword,
            fromAddress: config.smtpFromAddress,
            fromName: config.smtpFromName,
            toAddress: to,
            toName,
            subject,
            body,
            isHtml: false
        }));

        if (result === true || result === 'true') {
            return true;
        }
        console.error('Email send failed:', result);
        return false;
    } catch (err) {
        console.error('Email send error:', err);
        toast.error(`Email send failed: ${err.message || err}`);
        return false;
    }
}

/**
 * Send a notification rule email.
 * @param {object} rule - The notification rule that was triggered
 * @param {string} message - The notification message
 * @param {object} eventData - Additional event data
 * @returns {Promise<boolean>}
 */
export async function sendRuleEmail(rule, message, eventData) {
    const emailStore = useEmailNotificationsSettingsStore();
    if (!emailStore.isConfigured()) {
        return false;
    }

    const subject = `[VRCX-Pro] ${rule.name || rule.type}`;
    const body = [
        `Notification Rule: ${rule.name || rule.type}`,
        `Type: ${rule.type}`,
        `Message: ${message}`,
        '',
        eventData ? `Details: ${JSON.stringify(eventData, null, 2)}` : '',
        '',
        `Time: ${new Date().toLocaleString()}`
    ].filter(Boolean).join('\n');

    return sendEmail({ subject, body });
}

/**
 * Send a general notification email.
 * @param {string} title
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export async function sendGeneralEmail(title, message) {
    return sendEmail({
        subject: `[VRCX-Pro] ${title}`,
        body: message
    });
}
