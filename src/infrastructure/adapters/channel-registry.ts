import type { MessagingChannel } from "@/domain/ports";
import type { ChannelType } from "@/domain/value-objects";
import { WhatsAppCloudAdapter } from "@/infrastructure/adapters/whatsapp-cloud";
import { InstagramDmAdapter } from "@/infrastructure/adapters/instagram-dm";
import { TelegramBotAdapter } from "@/infrastructure/adapters/telegram-bot";

type ChannelRow = {
  type: ChannelType;
  phone_number_id?: string | null;
  ig_user_id?: string | null;
  telegram_bot_id?: string | null;
};

const factories: Record<ChannelType, () => MessagingChannel> = {
  whatsapp: () => new WhatsAppCloudAdapter(),
  instagram: () => new InstagramDmAdapter(),
  telegram: () => new TelegramBotAdapter(),
};

/** Resolve MessagingChannel adapter by channel type. Add new channels here. */
export function getChannelAdapter(type: ChannelType): MessagingChannel {
  const factory = factories[type];
  if (!factory) {
    throw new Error(`Unsupported channel type: ${type}`);
  }
  return factory();
}

/**
 * Provider "from" id used by Graph/Bot APIs.
 * Telegram Bot API only needs the bot token; we still return bot id for logging/guards.
 */
export function getOutboundFromId(channel: ChannelRow): string | null {
  switch (channel.type) {
    case "whatsapp":
      return channel.phone_number_id ?? null;
    case "instagram":
      return channel.ig_user_id ?? null;
    case "telegram":
      return channel.telegram_bot_id ?? null;
    default:
      return null;
  }
}
