import type { InboundMessage } from "@/domain/ports";

interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TgMessage {
  message_id: number;
  date: number;
  from?: TgUser;
  chat: { id: number; type: string };
  text?: string;
  caption?: string;
  photo?: unknown[];
  video?: unknown;
  voice?: unknown;
  audio?: unknown;
  document?: unknown;
  sticker?: unknown;
  location?: unknown;
  contact?: { phone_number?: string; user_id?: number };
}

export interface TgUpdate {
  update_id?: number;
  message?: TgMessage;
}

function mediaLabel(msg: TgMessage): string | null {
  if (msg.photo) return "[imagem]";
  if (msg.video) return "[vídeo]";
  if (msg.voice || msg.audio) return "[áudio]";
  if (msg.document) return "[documento]";
  if (msg.sticker) return "[figurinha]";
  if (msg.location) return "[localização]";
  if (msg.contact) return "[contato]";
  return null;
}

/** Only private chats with a human are handled; groups, channels and edits are ignored. */
export function parseTelegramUpdate(update: TgUpdate): InboundMessage[] {
  const msg = update.message;
  if (!msg || msg.chat.type !== "private" || !msg.from || msg.from.is_bot) return [];

  const label = mediaLabel(msg);
  const text = msg.text ?? (label ? [label, msg.caption].filter(Boolean).join(" ") : null);
  const content = text?.trim();
  if (!content) return [];

  const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ") || msg.from.username || null;
  // A contact sharing their own number is the only way Telegram exposes a phone.
  const sharedOwnPhone =
    msg.contact?.user_id === msg.from.id && msg.contact.phone_number
      ? `+${msg.contact.phone_number.replace(/^\+/, "")}`
      : null;

  const chatId = String(msg.chat.id);
  return [
    {
      channel: "telegram",
      // message_id is only unique within a chat.
      externalMessageId: `${chatId}:${msg.message_id}`,
      externalConversationId: chatId,
      senderExternalId: String(msg.from.id),
      senderName: name,
      senderPhone: sharedOwnPhone,
      senderEmail: null,
      content,
      timestamp: new Date(msg.date * 1000),
      accountId: "",
    },
  ];
}
