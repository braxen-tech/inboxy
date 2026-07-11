import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventBus, InboundMessage } from "@/domain/ports";
import {
  toConversationId,
  toMessageId,
  toOrgId,
} from "@/domain/value-objects";
import { getEventBus } from "@/infrastructure/events/get-event-bus";
import { incrementUsage } from "@/application/services/usage-tracker";
import { cancelPendingFollowups } from "@/application/services/cancel-pending-followups";
import { isBotQueueStatus, type ConversationStatus } from "@/lib/conversation-status";
import { normalizeChatwootChannel } from "@/lib/chatwoot-channel";
import { logger } from "@/lib/logger";
import { randomUUID } from "node:crypto";

function conversationChannelFields(msg: InboundMessage): {
  chatwoot_channel?: string;
  chatwoot_inbox_id?: number;
} {
  const fields: { chatwoot_channel?: string; chatwoot_inbox_id?: number } = {};
  if (msg.chatwootChannel) {
    fields.chatwoot_channel = msg.chatwootChannel;
  }
  if (msg.chatwootInboxId != null) {
    fields.chatwoot_inbox_id = msg.chatwootInboxId;
  }
  return fields;
}

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
  options: {
    initialConversationStatus?: ConversationStatus | null;
    requirePending?: boolean;
    /** When true, enqueue if Supabase status is pending even if Chatwoot reports open (desync). */
    trustDbBotQueue?: boolean;
  } = {},
  deps: { eventBus?: EventBus } = {},
): Promise<void> {
  const eventBus = deps.eventBus ?? getEventBus();
  const correlationId = randomUUID();
  const channelFields = conversationChannelFields(msg);
  const ctx = {
    correlationId,
    externalMessageId: msg.externalMessageId,
    orgId,
    ...(msg.chatwootChannel
      ? { chatwootChannel: msg.chatwootChannel, channel: normalizeChatwootChannel(msg.chatwootChannel) }
      : {}),
    ...(msg.chatwootInboxId != null ? { chatwootInboxId: msg.chatwootInboxId } : {}),
  };

  const { data: existing } = await db
    .from("processed_webhook_events")
    .select("event_id")
    .eq("event_id", `cw:${msg.externalMessageId}`)
    .maybeSingle();

  if (existing) {
    logger.info("Duplicate chatwoot webhook event, skipping", ctx);
    return;
  }

  const contactIdentifier = msg.senderPhone ?? msg.senderEmail ?? `cw:${msg.externalMessageId}`;
  const { data: contact } = await db
    .from("contacts")
    .upsert(
      {
        organization_id: orgId,
        phone: contactIdentifier,
        profile_name: msg.senderName,
        name: msg.senderName,
      },
      { onConflict: "organization_id,phone" },
    )
    .select("id, metadata")
    .single();

  if (!contact) {
    logger.error("Contact upsert failed", ctx);
    return;
  }

  if (msg.senderChatwootId != null) {
    const existingMetadata =
      contact.metadata && typeof contact.metadata === "object"
        ? (contact.metadata as Record<string, unknown>)
        : {};
    const currentCwId = existingMetadata.chatwoot_contact_id;
    if (currentCwId !== msg.senderChatwootId) {
      await db
        .from("contacts")
        .update({
          metadata: {
            ...existingMetadata,
            chatwoot_contact_id: msg.senderChatwootId,
          },
        })
        .eq("id", contact.id);
    }
  }

  const defaultStatus: ConversationStatus =
    options.initialConversationStatus && isBotQueueStatus(options.initialConversationStatus)
      ? "pending"
      : options.initialConversationStatus ?? "pending";

  let { data: conversation } = await db
    .from("conversations")
    .select("id, status")
    .eq("organization_id", orgId)
    .eq("chatwoot_conversation_id", msg.chatwootConversationId)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    const { data: newConv } = await db
      .from("conversations")
      .insert({
        organization_id: orgId,
        contact_id: contact.id,
        chatwoot_conversation_id: msg.chatwootConversationId,
        status: defaultStatus,
        last_message_at: new Date().toISOString(),
        last_inbound_at: new Date().toISOString(),
        ...channelFields,
      })
      .select("id, status")
      .single();
    conversation = newConv;
  } else {
    await db
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_inbound_at: new Date().toISOString(),
        ...channelFields,
      })
      .eq("id", conversation.id);

    if (
      options.initialConversationStatus &&
      conversation.status !== options.initialConversationStatus
    ) {
      await db
        .from("conversations")
        .update({ status: options.initialConversationStatus })
        .eq("id", conversation.id);
      conversation = { ...conversation, status: options.initialConversationStatus };
    }
  }

  if (!conversation) {
    logger.error("Conversation upsert failed", ctx);
    return;
  }

  await cancelPendingFollowups(db, conversation.id, "inbound_message");

  const { data: insertedMsg, error: msgError } = await db
    .from("messages")
    .insert({
      organization_id: orgId,
      conversation_id: conversation.id,
      direction: "inbound",
      content: msg.content,
      external_message_id: `cw:${msg.externalMessageId}`,
      status: "received",
      correlation_id: correlationId,
    })
    .select("id")
    .single();

  if (msgError?.code === "23505") {
    logger.info("Duplicate message, skipping", ctx);
    return;
  }

  if (!insertedMsg) {
    logger.error("Message insert failed", { ...ctx, error: msgError });
    return;
  }

  await db.from("processed_webhook_events").insert({
    event_id: `cw:${msg.externalMessageId}`,
    source: "chatwoot",
  });

  await incrementUsage(db, orgId, { messagesIn: 1 });

  const cwAllowsBot =
    !options.initialConversationStatus || isBotQueueStatus(options.initialConversationStatus);

  const dbAllowsBot = isBotQueueStatus(conversation.status);
  const skipForCwPending =
    options.requirePending && !cwAllowsBot && !options.trustDbBotQueue;

  if (!dbAllowsBot || skipForCwPending) {
    logger.info("Conversation not in bot queue, skipping agent", {
      ...ctx,
      conversationId: conversation.id,
      status: conversation.status,
    });
    return;
  }

  await eventBus.emit({
    type: "message.received",
    payload: {
      orgId: toOrgId(orgId),
      conversationId: toConversationId(conversation.id),
      messageId: toMessageId(insertedMsg.id),
      correlationId,
    },
  });

  logger.info("Chatwoot inbound enqueued (Inngest)", {
    ...ctx,
    conversationId: conversation.id,
  });
}
