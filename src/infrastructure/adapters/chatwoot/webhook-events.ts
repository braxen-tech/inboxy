import type { InboundMessage } from "@/domain/ports";
import type { ConversationStatus } from "@/lib/conversation-status";
import { normalizeChatwootConversationStatus } from "@/lib/conversation-status";
import { parseChatwootChannel } from "@/lib/chatwoot-channel";

export type ChatwootWebhookEvent =
  | { type: "message_created"; message: InboundMessage; conversationStatus: ConversationStatus | null }
  | { type: "conversation_updated"; chatwootConversationId: number; status: ConversationStatus }
  | { type: "ignored"; reason: string };

interface RawPayload {
  event: string;
  id?: number;
  content?: string | null;
  content_type?: string;
  message_type?: string | number;
  created_at?: string;
  private?: boolean;
  sender?: {
    id: number;
    name: string | null;
    email: string | null;
    phone_number: string | null;
    type?: string;
  };
  conversation?: {
    id: number;
    inbox_id?: number;
    channel?: string;
    status?: string;
  };
  account?: {
    id: number;
    name?: string;
  };
}

export function parseChatwootWebhookPayload(payload: RawPayload): ChatwootWebhookEvent {
  if (payload.event === "conversation_updated") {
    const convId = payload.conversation?.id;
    const status = normalizeChatwootConversationStatus(payload.conversation?.status);
    if (!convId || !status) {
      return { type: "ignored", reason: "conversation_updated without id or valid status" };
    }
    return {
      type: "conversation_updated",
      chatwootConversationId: convId,
      status,
    };
  }

  if (payload.event !== "message_created") {
    return { type: "ignored", reason: `event: ${payload.event}` };
  }

  const messageType = payload.message_type;
  const isIncoming =
    messageType === "incoming" || messageType === 0 || messageType === "0";
  if (!isIncoming) {
    return { type: "ignored", reason: "not incoming" };
  }

  const senderType = payload.sender?.type?.toLowerCase();
  if (senderType === "user" || senderType === "agent_bot" || senderType === "agentbot") {
    return { type: "ignored", reason: `sender: ${payload.sender?.type}` };
  }

  if (payload.private) {
    return { type: "ignored", reason: "private note" };
  }

  if (!payload.content?.trim()) {
    return { type: "ignored", reason: "empty content" };
  }

  if (!payload.conversation?.id || !payload.account?.id) {
    return { type: "ignored", reason: "missing conversation or account" };
  }

  const message: InboundMessage = {
    externalMessageId: String(payload.id),
    chatwootConversationId: payload.conversation.id,
    senderName: payload.sender?.name ?? null,
    senderPhone: payload.sender?.phone_number ?? null,
    senderEmail: payload.sender?.email ?? null,
    senderChatwootId: payload.sender?.id ?? null,
    chatwootChannel: parseChatwootChannel(payload.conversation.channel),
    chatwootInboxId: payload.conversation.inbox_id ?? null,
    content: payload.content,
    timestamp: new Date(payload.created_at ?? Date.now()),
    accountId: String(payload.account.id),
  };

  return {
    type: "message_created",
    message,
    conversationStatus: normalizeChatwootConversationStatus(payload.conversation.status),
  };
}
