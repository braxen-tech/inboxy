import type { Result } from "../errors";

export type NativeChannelKind = "whatsapp_cloud" | "telegram";
export type ChannelKind = "chatwoot" | NativeChannelKind;

export interface ChatwootInboundMeta {
  conversationId: number;
  /** Chatwoot contact ID from webhook sender.id */
  senderId?: number | null;
  /** Raw Chatwoot channel type, e.g. Channel::Whatsapp */
  channel?: string | null;
  inboxId?: number | null;
}

export interface InboundMessage {
  channel: ChannelKind;
  externalMessageId: string;
  /** Channel-side thread key: Chatwoot conversation id, WhatsApp wa_id, Telegram chat id. */
  externalConversationId: string;
  senderExternalId: string | null;
  senderName: string | null;
  senderPhone: string | null;
  senderEmail: string | null;
  content: string;
  timestamp: Date;
  /** Chatwoot account id, WhatsApp phone_number_id, Telegram bot id. */
  accountId: string;
  chatwoot?: ChatwootInboundMeta;
}

export interface Attachment {
  url: string;
  filename?: string;
}

export type SendTarget =
  | {
      kind: "chatwoot";
      apiUrl: string;
      apiToken: string;
      accountId: string;
      conversationId: number;
      /** When set, message is sent as Chatwoot AgentBot (requires bot access token). */
      agentBotId?: number;
    }
  | { kind: "whatsapp_cloud"; phoneNumberId: string; accessToken: string; to: string }
  | { kind: "telegram"; botToken: string; chatId: string };

export interface SendParams<T extends SendTarget = SendTarget> {
  target: T;
  content: string;
  attachments?: Attachment[];
}

export type SendError = {
  code: "RATE_LIMITED" | "API_ERROR" | "NETWORK_ERROR" | "UNAUTHORIZED";
  message: string;
  httpStatus?: number;
};

export type WebhookError = {
  code: "SECRET_INVALID" | "PARSE_FAILED" | "IGNORED_EVENT";
  message: string;
};

export interface MessagingChannel {
  parseWebhook(request: Request, secret: string): Promise<Result<InboundMessage[], WebhookError>>;
  send(params: SendParams): Promise<Result<string, SendError>>;
}
