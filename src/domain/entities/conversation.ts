import type { ChannelId, ChannelType, ContactId, ConversationId, LeadId, OrgId, UserId } from "../value-objects";

export type ConversationStatus = "pending" | "open" | "snoozed" | "resolved" | "closed";
export type ConversationPriority = "low" | "normal" | "high" | "urgent";

export interface Conversation {
  id: ConversationId;
  organizationId: OrgId;
  contactId: ContactId;
  channelId: ChannelId | null;
  channelType: ChannelType | null;
  externalConversationId: string | null;
  status: ConversationStatus;
  priority: ConversationPriority;
  assignedTo: UserId | null;
  leadId: LeadId | null;
  unreadCount: number;
  lastMessageAt: Date | null;
  lastInboundAt: Date | null;
  processingLockUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
