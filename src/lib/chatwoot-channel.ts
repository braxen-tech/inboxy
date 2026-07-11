const CHANNEL_SLUGS: Record<string, string> = {
  "Channel::Whatsapp": "whatsapp",
  "Channel::Telegram": "telegram",
  "Channel::Instagram": "instagram",
  "Channel::FacebookPage": "messenger",
  "Channel::Email": "email",
  "Channel::WebWidget": "web_widget",
  "Channel::Sms": "sms",
  "Channel::TwilioSms": "twilio_sms",
  "Channel::Line": "line",
  "Channel::TwitterProfile": "twitter",
  "Channel::Tiktok": "tiktok",
  "Channel::Api": "api",
};

export function parseChatwootChannel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeChatwootChannel(raw: string): string {
  const known = CHANNEL_SLUGS[raw];
  if (known) return known;

  const prefix = "Channel::";
  if (raw.startsWith(prefix)) {
    return raw
      .slice(prefix.length)
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .toLowerCase();
  }

  return raw.toLowerCase();
}
