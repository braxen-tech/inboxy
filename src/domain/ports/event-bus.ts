import type { OrgId, ConversationId, MessageId } from "../value-objects";

export type DomainEvent =
  | {
      type: "message.received";
      payload: {
        orgId: OrgId;
        conversationId: ConversationId;
        messageId: MessageId;
        correlationId: string;
      };
    }
  | {
      type: "message.sent";
      payload: {
        orgId: OrgId;
        conversationId: ConversationId;
        messageId: MessageId;
        correlationId: string;
      };
    }
  | {
      type: "chatwoot.connected";
      payload: { orgId: OrgId; accountId: string };
    }
  | {
      type: "kb.document.uploaded";
      payload: { orgId: OrgId; documentId: string };
    };

export interface EventBus {
  emit(event: DomainEvent): Promise<void>;
}
