import type { Result } from "../errors";
import type { OrgId, PhoneNumber } from "../value-objects";

export interface InboundMessage {
  whatsappMessageId: string;
  from: PhoneNumber;
  profileName: string | null;
  content: string;
  timestamp: Date;
  phoneNumberId: string;
}

export interface SendParams {
  orgId: OrgId;
  to: PhoneNumber;
  content: string;
  phoneNumberId: string;
  accessToken: string;
}

export type SendError = { code: "RATE_LIMITED" | "OUTSIDE_24H" | "API_ERROR" | "NETWORK_ERROR"; message: string };

export interface VerifiedPayload {
  raw: unknown;
}

export type WebhookError = { code: "SIGNATURE_INVALID" | "PARSE_FAILED"; message: string };

export interface MessagingChannel {
  verifyWebhook(request: Request, appSecret: string): Promise<Result<VerifiedPayload, WebhookError>>;
  parseInbound(payload: VerifiedPayload): InboundMessage[];
  send(params: SendParams): Promise<Result<string, SendError>>;
}
