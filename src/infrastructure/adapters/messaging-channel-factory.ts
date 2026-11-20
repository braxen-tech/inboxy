import type { ChannelKind, MessagingChannel } from "@/domain/ports";
import { ChatwootAdapter } from "./chatwoot/adapter";
import { TelegramAdapter } from "./telegram/adapter";
import { WhatsAppCloudAdapter } from "./whatsapp-cloud/adapter";

export function createMessagingChannel(kind: ChannelKind): MessagingChannel {
  switch (kind) {
    case "chatwoot":
      return new ChatwootAdapter();
    case "whatsapp_cloud":
      return new WhatsAppCloudAdapter();
    case "telegram":
      return new TelegramAdapter();
  }
}
