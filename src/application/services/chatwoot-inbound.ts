import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventBus, InboundMessage } from "@/domain/ports";
import { cancelPendingFollowups } from "@/application/services/cancel-pending-followups";
import { ingestInboundMessage, type IngestOptions } from "@/application/services/inbound-message";
import { isBotQueueStatus, type ConversationStatus } from "@/lib/conversation-status";
import { logger } from "@/lib/logger";

export async function syncConversationStatusByChatwootId(
  db: SupabaseClient,
  orgId: string,
  chatwootConversationId: number,
  status: ConversationStatus,
): Promise<void> {
  const { error } = await db
    .from("conversations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("chatwoot_conversation_id", chatwootConversationId);

  if (error) {
    logger.warn("Failed to sync conversation status", {
      orgId,
      chatwootConversationId,
      status,
      error: error.message,
    });
    return;
  }

  if (!isBotQueueStatus(status)) {
    const { data: conversation } = await db
      .from("conversations")
      .select("id")
      .eq("organization_id", orgId)
      .eq("chatwoot_conversation_id", chatwootConversationId)
      .maybeSingle();

    if (conversation) {
      await cancelPendingFollowups(db, conversation.id, `status_${status}`);
    }
  }
}

export async function processChatwootInboundMessage(
  db: SupabaseClient,
  orgId: string,
  msg: InboundMessage,
  options: IngestOptions = {},
  deps: { eventBus?: EventBus } = {},
): Promise<void> {
  const cw = msg.chatwoot;
  if (!cw) {
    logger.error("Chatwoot inbound without chatwoot metadata", { orgId, externalMessageId: msg.externalMessageId });
    return;
  }

  await ingestInboundMessage(
    db,
    {
      orgId,
      msg,
      key: {
        kind: "chatwoot",
        chatwootConversationId: cw.conversationId,
        fields: {
          ...(cw.channel ? { chatwoot_channel: cw.channel } : {}),
          ...(cw.inboxId != null ? { chatwoot_inbox_id: cw.inboxId } : {}),
        },
      },
      eventId: `cw:${msg.externalMessageId}`,
      source: "chatwoot",
      contactIdentifier: msg.senderPhone ?? msg.senderEmail ?? `cw:${msg.externalMessageId}`,
      ...(cw.senderId != null ? { contactMetadata: { chatwoot_contact_id: cw.senderId } } : {}),
      options,
    },
    deps,
  );
}
