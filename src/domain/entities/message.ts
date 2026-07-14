import type { ConversationId, CorrelationId, MessageId, OrgId, UserId } from "../value-objects";

export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "received" | "processing" | "replied" | "failed";
export type MessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "location"
  | "contact"
  | "template";

export interface MessageAttachment {
  url: string;
  contentType?: string;
  filename?: string;
  size?: number;
}

export interface Message {
  id: MessageId;
  organizationId: OrgId;
  conversationId: ConversationId;
  direction: MessageDirection;
  content: string;
  messageType: MessageType;
  attachments: MessageAttachment[];
  externalMessageId: string | null;
  senderUserId: UserId | null;
  isInternalNote: boolean;
  status: MessageStatus;
  aiMetadata: Record<string, unknown> | null;
  correlationId: CorrelationId | null;
  createdAt: Date;
}
