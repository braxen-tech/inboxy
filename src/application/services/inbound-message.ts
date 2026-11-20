import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventBus, InboundMessage, NativeChannelKind } from "@/domain/ports";
import { toConversationId, toMessageId, toOrgId } from "@/domain/value-objects";
import { getEventBus } from "@/infrastructure/events/get-event-bus";
import { incrementUsage } from "@/application/services/usage-tracker";
import { cancelPendingFollowups } from "@/application/services/cancel-pending-followups";
import { isBotQueueStatus, type ConversationStatus } from "@/lib/conversation-status";
import { logger } from "@/lib/logger";
import { randomUUID } from "node:crypto";

/** How an inbound message finds (or creates) its local conversation row. */
export type ConversationKey =
  | {
      kind: "chatwoot";
      chatwootConversationId: number;
      fields: { chatwoot_channel?: string; chatwoot_inbox_id?: number };
    }
  | {
      kind: "connection";
      connectionId: string;
      channel: NativeChannelKind;
      externalContactId: string;
    };

export interface IngestOptions {
  initialConversationStatus?: ConversationStatus | null;
  requirePending?: boolean;
  /** When true, enqueue if Supabase status is pending even if the channel reports open (desync). */
  trustDbBotQueue?: boolean;
}

export interface IngestInput {
  orgId: string;
  msg: InboundMessage;
  key: ConversationKey;
  /** Globally unique id used for dedup in processed_webhook_events and messages.external_message_id. */
  eventId: string;
  source: string;
  /** Value stored in contacts.phone (the contact's identity per org). */
  contactIdentifier: string;
  contactMetadata?: Record<string, unknown>;
  options?: IngestOptions;
}

function conversationFilter(key: ConversationKey): Record<string, string | number> {
  return key.kind === "chatwoot"
    ? { chatwoot_conversation_id: key.chatwootConversationId }
    : { channel_connection_id: key.connectionId, external_contact_id: key.externalContactId };
}

function conversationFields(key: ConversationKey): Record<string, string | number> {
  return key.kind === "chatwoot"
    ? { chatwoot_conversation_id: key.chatwootConversationId, ...key.fields }
    : {
        channel: key.channel,
        channel_connection_id: key.connectionId,
        external_contact_id: key.externalContactId,
      };
}

export async function ingestInboundMessage(
  db: SupabaseClient,
  input: IngestInput,
  deps: { eventBus?: EventBus } = {},
): Promise<void> {
  const { orgId, msg, key, eventId, options = {} } = input;
  const eventBus = deps.eventBus ?? getEventBus();
  const correlationId = randomUUID();
  const ctx = { correlationId, eventId, orgId, channel: msg.channel };

  const { data: existing } = await db
    .from("processed_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    logger.info("Duplicate inbound event, skipping", ctx);
    return;
  }

  const { data: contact } = await db
    .from("contacts")
    .upsert(
      {
        organization_id: orgId,
        phone: input.contactIdentifier,
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

  if (input.contactMetadata) {
    const existingMetadata =
      contact.metadata && typeof contact.metadata === "object"
        ? (contact.metadata as Record<string, unknown>)
        : {};
    const changed = Object.entries(input.contactMetadata).some(
      ([k, v]) => existingMetadata[k] !== v,
    );
    if (changed) {
      await db
        .from("contacts")
        .update({ metadata: { ...existingMetadata, ...input.contactMetadata } })
        .eq("id", contact.id);
    }
  }

  const defaultStatus: ConversationStatus =
    options.initialConversationStatus && isBotQueueStatus(options.initialConversationStatus)
      ? "pending"
      : options.initialConversationStatus ?? "pending";

  let lookup = db
    .from("conversations")
    .select("id, status")
    .eq("organization_id", orgId);
  for (const [column, value] of Object.entries(conversationFilter(key))) {
    lookup = lookup.eq(column, value);
  }
  let { data: conversation } = await lookup
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  if (!conversation) {
    const { data: newConv } = await db
      .from("conversations")
      .insert({
        organization_id: orgId,
        contact_id: contact.id,
        status: defaultStatus,
        last_message_at: now,
        last_inbound_at: now,
        ...conversationFields(key),
      })
      .select("id, status")
      .single();
    conversation = newConv;
  } else {
    await db
      .from("conversations")
      .update({
        last_message_at: now,
        last_inbound_at: now,
        ...(key.kind === "chatwoot" ? key.fields : {}),
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
      external_message_id: eventId,
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

  await db.from("processed_webhook_events").insert({ event_id: eventId, source: input.source });

  await incrementUsage(db, orgId, { messagesIn: 1 });

  const channelAllowsBot =
    !options.initialConversationStatus || isBotQueueStatus(options.initialConversationStatus);
  const dbAllowsBot = isBotQueueStatus(conversation.status);
  const skipForChannelStatus =
    options.requirePending && !channelAllowsBot && !options.trustDbBotQueue;

  if (!dbAllowsBot || skipForChannelStatus) {
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

  logger.info("Inbound message enqueued (Inngest)", { ...ctx, conversationId: conversation.id });
}
