import type { Result } from "../errors";
import type { ChannelType } from "../value-objects";

export interface InboundMessage {
  channelType: ChannelType;
  /** Provider-specific id of the incoming message (wamid / IG mid). */
  externalMessageId: string;
  /** Provider-specific thread/conversation identifier. */
  externalConversationId: string;
  /** Sender profile info from the provider payload. */
  senderName: string | null;
  senderPhone: string | null;
  senderEmail: string | null;
  /** For Instagram: the sender IG user id (PSID / IGSID). */
  senderExternalId: string | null;
  /** For Instagram: sender IG username if available. */
  senderUsername: string | null;
  /** For WhatsApp: E.164 number of the business phone that received the message. */
  recipientPhoneNumberId?: string | null;
  /** For Instagram: the IG business user id that received the message. */
  recipientIgUserId?: string | null;
  /** For Telegram: the bot id that received the message (from getMe). */
  recipientTelegramBotId?: string | null;
  content: string;
  attachments: InboundAttachment[];
  timestamp: Date;
}

export interface InboundAttachment {
  url?: string;
  mediaId?: string;
  contentType?: string;
  filename?: string;
}

export interface OutboundAttachment {
  url: string;
  filename?: string;
  contentType?: string;
}

export interface SendParams {
  accessToken: string;
  /** Provider "from" id: WA phone_number_id, IG user id, Telegram bot id (unused by Bot API). */
  fromExternalId: string;
  /** Recipient: WA phone (E.164), IG IGSID, or Telegram chat_id. */
  toExternalId: string;
  content: string;
  attachments?: OutboundAttachment[];
}

export type SendError = {
  code: "RATE_LIMITED" | "API_ERROR" | "NETWORK_ERROR" | "UNAUTHORIZED" | "INVALID_RECIPIENT";
  message: string;
  httpStatus?: number;
};

export type WebhookError = {
  code: "SECRET_INVALID" | "PARSE_FAILED" | "IGNORED_EVENT" | "UNSUPPORTED";
  message: string;
};

export interface WebhookVerification {
  mode: string;
  token: string;
  challenge: string;
}

export interface MessagingChannel {
  readonly type: ChannelType;
  /** Handle the Meta webhook GET verification handshake. */
  verifyWebhook(params: WebhookVerification, expectedToken: string): string | null;
  /** Parse an incoming Meta webhook payload into normalized inbound messages. */
  parseWebhook(rawBody: string, signature: string | null, appSecret: string): Promise<Result<InboundMessage[], WebhookError>>;
  /** Send an outbound message via the provider API. */
  send(params: SendParams): Promise<Result<string, SendError>>;
}
