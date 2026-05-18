import type { ContactId, ConversationId, OrgId } from "../value-objects";

export type ConversationStatus = "active" | "human" | "closed";

export interface Conversation {
  id: ConversationId;
  organizationId: OrgId;
  contactId: ContactId;
  status: ConversationStatus;
  lastMessageAt: Date | null;
  lastInboundAt: Date | null;
  processingLockUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
