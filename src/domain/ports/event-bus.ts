import type { ChannelId, ConversationId, LeadId, MessageId, OrgId, UserId } from "../value-objects";
import type { ChannelType } from "../value-objects";

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
      type: "channel.connected";
      payload: { orgId: OrgId; channelId: ChannelId; channelType: ChannelType };
    }
  | {
      type: "conversation.assigned";
      payload: { orgId: OrgId; conversationId: ConversationId; assignedTo: UserId };
    }
  | {
      type: "lead.stage_changed";
      payload: { orgId: OrgId; leadId: LeadId; fromStageId: string; toStageId: string };
    }
  | {
      type: "kb.document.uploaded";
      payload: { orgId: OrgId; documentId: string };
    };

export interface EventBus {
  emit(event: DomainEvent): Promise<void>;
}
