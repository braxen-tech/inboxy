import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventBus, InboundMessage } from "@/domain/ports";
import { toConversationId, toMessageId, toOrgId } from "@/domain/value-objects";
import { getEventBus } from "@/infrastructure/events/get-event-bus";
import { incrementUsage } from "@/application/services/usage-tracker";
import { notifyUser } from "@/application/services/notify-user";
import { logger } from "@/lib/logger";
import { randomUUID } from "node:crypto";

/**
 * Resolves the channel row that owns an inbound Meta message,
 * using WhatsApp phone_number_id or Instagram ig_user_id.
 */
export async function resolveChannelForInbound(
  db: SupabaseClient,
  msg: InboundMessage,
): Promise<{ id: string; organization_id: string; type: string } | null> {
  const query = db.from("channels").select("id, organization_id, type").eq("status", "active");

  if (msg.channelType === "whatsapp" && msg.recipientPhoneNumberId) {
    const { data } = await query.eq("type", "whatsapp").eq("phone_number_id", msg.recipientPhoneNumberId).maybeSingle();
    return data;
  }

  if (msg.channelType === "instagram" && msg.recipientIgUserId) {
    const { data } = await query.eq("type", "instagram").eq("ig_user_id", msg.recipientIgUserId).maybeSingle();
    return data;
  }

  return null;
}

/**
 * Persists an inbound Meta message: upserts contact, upserts open conversation,
 * inserts message row, marks event as processed, emits domain event.
 */
export async function processMetaInboundMessage(
  db: SupabaseClient,
  channel: { id: string; organization_id: string; type: string },
  msg: InboundMessage,
  deps: { eventBus?: EventBus } = {},
): Promise<void> {
  const eventBus = deps.eventBus ?? getEventBus();
  const correlationId = randomUUID();
  const eventId = `meta:${msg.channelType}:${msg.externalMessageId}`;

  // Idempotency check
  const { data: dupe } = await db
    .from("processed_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (dupe) {
    logger.info("Duplicate meta webhook event, skipping", { eventId });
    return;
  }

  // Upsert contact by (org, phone) for WA or (org, ig_user_id) for IG
  const orgId = channel.organization_id;
  let contactId: string;

  if (msg.channelType === "whatsapp") {
    const phone = msg.senderPhone;
    if (!phone) {
      logger.warn("WhatsApp inbound without sender phone, skipping", { eventId });
      return;
    }
    const { data: contact, error } = await db
      .from("contacts")
      .upsert(
        {
          organization_id: orgId,
          phone,
          profile_name: msg.senderName,
          name: msg.senderName,
        },
        { onConflict: "organization_id,phone" },
      )
      .select("id")
      .single();
    if (error || !contact) {
      logger.error("Contact upsert failed (whatsapp)", { eventId, error });
      return;
    }
    contactId = contact.id;
  } else {
    // Instagram: find-or-create by ig_user_id
    const igUserId = msg.senderExternalId;
    if (!igUserId) {
      logger.warn("Instagram inbound without IGSID, skipping", { eventId });
      return;
    }
    const { data: existing } = await db
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("ig_user_id", igUserId)
      .maybeSingle();

    if (existing) {
      contactId = existing.id;
      if (msg.senderUsername) {
        await db.from("contacts").update({ ig_username: msg.senderUsername }).eq("id", contactId);
      }
    } else {
      const { data: created, error } = await db
        .from("contacts")
        .insert({
          organization_id: orgId,
          ig_user_id: igUserId,
          ig_username: msg.senderUsername,
          profile_name: msg.senderUsername,
          name: msg.senderUsername,
        })
        .select("id")
        .single();
      if (error || !created) {
        logger.error("Contact insert failed (instagram)", { eventId, error });
        return;
      }
      contactId = created.id;
    }
  }

  // Upsert open conversation for (contact, channel)
  const now = new Date().toISOString();
  let { data: conversation } = await db
    .from("conversations")
    .select("id, status, unread_count, assigned_to")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .eq("channel_id", channel.id)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    const { data: created } = await db
      .from("conversations")
      .insert({
        organization_id: orgId,
        contact_id: contactId,
        channel_id: channel.id,
        channel_type: msg.channelType,
        external_conversation_id: msg.externalConversationId,
        status: "pending",
        last_message_at: now,
        last_inbound_at: now,
        unread_count: 1,
      })
      .select("id, status, unread_count, assigned_to")
      .single();
    conversation = created;
  } else {
    await db
      .from("conversations")
      .update({
        last_message_at: now,
        last_inbound_at: now,
        unread_count: (conversation.unread_count ?? 0) + 1,
      })
      .eq("id", conversation.id);
  }

  if (!conversation) {
    logger.error("Conversation upsert failed", { eventId });
    return;
  }

  // Insert message row
  const { data: inserted, error: msgError } = await db
    .from("messages")
    .insert({
      organization_id: orgId,
      conversation_id: conversation.id,
      direction: "inbound",
      content: msg.content,
      message_type: inferMessageType(msg),
      attachments: msg.attachments,
      external_message_id: eventId,
      status: "received",
      correlation_id: correlationId,
    })
    .select("id")
    .single();

  if (msgError?.code === "23505") {
    logger.info("Duplicate message row, skipping", { eventId });
    return;
  }

  if (!inserted) {
    logger.error("Message insert failed", { eventId, error: msgError });
    return;
  }

  await db.from("processed_webhook_events").insert({ event_id: eventId, source: `meta:${msg.channelType}` });

  await incrementUsage(db, orgId, { messagesIn: 1 });

  await eventBus.emit({
    type: "message.received",
    payload: {
      orgId: toOrgId(orgId),
      conversationId: toConversationId(conversation.id),
      messageId: toMessageId(inserted.id),
      correlationId,
    },
  });

  // Notify assignee (if any) about the new inbound message.
  if (conversation.assigned_to) {
    await notifyUser(db, {
      organizationId: orgId,
      userId: conversation.assigned_to,
      type: "new_message",
      title: "Nova mensagem",
      body: msg.content.slice(0, 160) || "(mensagem sem texto)",
      actionUrl: `/inbox?conversation=${conversation.id}`,
      entityType: "conversation",
      entityId: conversation.id,
      metadata: { conversationId: conversation.id, channelType: msg.channelType },
    });
  }

  logger.info("Meta inbound processed", {
    eventId,
    orgId,
    channelType: msg.channelType,
    conversationId: conversation.id,
  });
}

function inferMessageType(msg: InboundMessage): string {
  if (msg.attachments.length === 0) return "text";
  const ct = msg.attachments[0]?.contentType ?? "";
  if (ct.startsWith("image")) return "image";
  if (ct.startsWith("audio")) return "audio";
  if (ct.startsWith("video")) return "video";
  return "document";
}
