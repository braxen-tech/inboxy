import type { Result } from "../errors";

export interface InboundMessage {
  externalMessageId: string;
  chatwootConversationId: number;
  senderName: string | null;
  senderPhone: string | null;
  senderEmail: string | null;
  content: string;
  timestamp: Date;
  accountId: string;
}

export interface SendParams {
  apiUrl: string;
  apiToken: string;
  accountId: string;
  conversationId: number;
  content: string;
}

export type SendError = {
  code: "RATE_LIMITED" | "API_ERROR" | "NETWORK_ERROR";
  message: string;
};

export type WebhookError = {
  code: "SECRET_INVALID" | "PARSE_FAILED" | "IGNORED_EVENT";
  message: string;
};

export interface MessagingChannel {
  parseWebhook(request: Request, secret: string): Promise<Result<InboundMessage[], WebhookError>>;
  send(params: SendParams): Promise<Result<string, SendError>>;
}
