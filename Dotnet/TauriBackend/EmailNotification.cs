using System.Net;
using System.Net.Mail;
using System.Text.Json;

namespace VRCX.TauriBackend;

public static class EmailNotification
{
    public static async Task<object> SendEmail(JsonElement args)
    {
        var config = JsonSerializer.Deserialize<EmailConfig>(args.GetRawText());
        if (config == null)
            throw new InvalidDataException("Invalid email configuration");

        if (string.IsNullOrWhiteSpace(config.SmtpHost))
            throw new ArgumentException("SMTP host is required");
        if (string.IsNullOrWhiteSpace(config.FromAddress))
            throw new ArgumentException("From address is required");
        if (string.IsNullOrWhiteSpace(config.ToAddress))
            throw new ArgumentException("Recipient address is required");

        using var message = new MailMessage();
        message.From = new MailAddress(config.FromAddress, config.FromName);
        message.To.Add(new MailAddress(config.ToAddress, config.ToName));
        message.Subject = config.Subject ?? string.Empty;
        message.Body = config.Body ?? string.Empty;
        message.IsBodyHtml = config.IsHtml;

        using var client = new SmtpClient(config.SmtpHost, config.SmtpPort)
        {
            EnableSsl = config.SmtpUseSsl,
            Timeout = 30000
        };

        if (!string.IsNullOrWhiteSpace(config.SmtpUsername) &&
            !string.IsNullOrWhiteSpace(config.SmtpPassword))
        {
            client.Credentials = new NetworkCredential(
                config.SmtpUsername,
                config.SmtpPassword
            );
        }

        await client.SendMailAsync(message);
        return true;
    }

    private class EmailConfig
    {
        public string SmtpHost { get; set; } = "";
        public int SmtpPort { get; set; } = 465;
        public bool SmtpUseSsl { get; set; } = true;
        public string SmtpUsername { get; set; } = "";
        public string SmtpPassword { get; set; } = "";
        public string FromAddress { get; set; } = "";
        public string FromName { get; set; } = "VRCX-Pro";
        public string ToAddress { get; set; } = "";
        public string ToName { get; set; } = "";
        public string Subject { get; set; } = "";
        public string Body { get; set; } = "";
        public bool IsHtml { get; set; } = false;
    }
}
