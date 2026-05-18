export type DomainErrorCode =
  | "WEBHOOK_SIGNATURE_INVALID"
  | "WEBHOOK_PARSE_FAILED"
  | "MESSAGE_DUPLICATE"
  | "ORG_NOT_FOUND"
  | "ORG_WHATSAPP_DISCONNECTED"
  | "CONTACT_UPSERT_FAILED"
  | "CONVERSATION_LOCKED"
  | "AGENT_RUN_FAILED"
  | "AGENT_TIMEOUT"
  | "AGENT_TOKEN_LIMIT_EXCEEDED"
  | "SEND_FAILED"
  | "SEND_RATE_LIMITED"
  | "SEND_OUTSIDE_24H_WINDOW"
  | "ENCRYPTION_FAILED"
  | "DECRYPTION_FAILED"
  | "CALENDAR_SLOTS_FAILED"
  | "CALENDAR_BOOKING_FAILED"
  | "BILLING_LIMIT_REACHED"
  | "TOOL_EXECUTION_FAILED"
  | "UNKNOWN";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
