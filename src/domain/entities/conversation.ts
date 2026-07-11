import type { ContactId, ConversationId, OrgId } from "../value-objects";

export type ConversationStatus = "pending" | "open" | "closed";

export interface Conversation {
  id: ConversationId;
  organizationId: OrgId;
  contactId: ContactId;
  status: ConversationStatus;
  lastMessageAt: Date | null;
  lastInboundAt: Date | null;
  processingLockUntil: Date | null;
  chatwootChannel?: string | null;
  chatwootInboxId?: number | null;
  createdAt: Date;
  updatedAt: Date;
}
