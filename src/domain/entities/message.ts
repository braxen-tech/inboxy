import type { ConversationId, CorrelationId, MessageId, OrgId } from "../value-objects";

export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "received" | "processing" | "replied" | "failed";

export interface Message {
  id: MessageId;
  organizationId: OrgId;
  conversationId: ConversationId;
  direction: MessageDirection;
  content: string;
  externalMessageId: string | null;
  status: MessageStatus;
  aiMetadata: Record<string, unknown> | null;
  correlationId: CorrelationId | null;
  createdAt: Date;
}
