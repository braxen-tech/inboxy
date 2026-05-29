import { NextResponse } from "next/server";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { ChatwootAdapter } from "@/infrastructure/adapters/chatwoot/adapter";
import { inngest } from "@/infrastructure/events/inngest-client";
import { incrementUsage } from "@/application/services/usage-tracker";
import { logger } from "@/lib/logger";
import { randomUUID } from "node:crypto";

const adapter = new ChatwootAdapter();

export async function POST(request: Request) {
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") ?? "";

  const db = getAdminClient();

  const body = await request.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const accountId = String(
    (payload.account as Record<string, unknown>)?.id ?? "",
  );
  if (!accountId) {
    return NextResponse.json({ status: "ignored", reason: "no account id" });
  }

  const { data: org } = await db
    .from("organizations")
    .select("id, chatwoot_webhook_secret")
    .eq("chatwoot_account_id", accountId)
    .eq("chatwoot_status", "active")
    .single();

  if (!org) {
    logger.warn("No active org for chatwoot account", { accountId });
    return NextResponse.json({ status: "ignored", reason: "unknown account" });
  }

  if (querySecret !== org.chatwoot_webhook_secret) {
    logger.warn("Chatwoot webhook secret mismatch", { accountId });
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  const fakeRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body,
  });

  const parseResult = await adapter.parseWebhook(fakeRequest, org.chatwoot_webhook_secret);
  if (!parseResult.ok) {
    if (parseResult.error.code === "IGNORED_EVENT") {
      return NextResponse.json({ status: "ignored", reason: parseResult.error.message });
    }
    logger.warn("Chatwoot webhook parse failed", { error: parseResult.error });
    return NextResponse.json({ error: parseResult.error.message }, { status: 400 });
  }

  const inboundMessages = parseResult.value;
  if (inboundMessages.length === 0) {
    return NextResponse.json({ status: "ok" });
  }

  for (const msg of inboundMessages) {
    const correlationId = randomUUID();
    const ctx = { correlationId, externalMessageId: msg.externalMessageId, accountId };

    try {
      const { data: existing } = await db
        .from("processed_webhook_events")
        .select("event_id")
        .eq("event_id", `cw:${msg.externalMessageId}`)
        .single();

      if (existing) {
        logger.info("Duplicate chatwoot webhook event, skipping", ctx);
        continue;
      }

      const orgId = org.id;

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
        .select("id")
        .single();

      if (!contact) {
        logger.error("Contact upsert failed", ctx);
        continue;
      }

      let { data: conversation } = await db
        .from("conversations")
        .select("id, status")
        .eq("organization_id", orgId)
        .eq("chatwoot_conversation_id", msg.chatwootConversationId)
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!conversation) {
        const { data: newConv } = await db
          .from("conversations")
          .insert({
            organization_id: orgId,
            contact_id: contact.id,
            chatwoot_conversation_id: msg.chatwootConversationId,
            status: "active",
            last_message_at: new Date().toISOString(),
            last_inbound_at: new Date().toISOString(),
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
          })
          .eq("id", conversation!.id);
      }

      if (!conversation) {
        logger.error("Conversation upsert failed", ctx);
        continue;
      }

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
        continue;
      }

      if (!insertedMsg) {
        logger.error("Message insert failed", { ...ctx, error: msgError });
        continue;
      }

      await db.from("processed_webhook_events").insert({
        event_id: `cw:${msg.externalMessageId}`,
        source: "chatwoot",
      });

      await incrementUsage(db, orgId, { messagesIn: 1 });

      if (conversation.status !== "human") {
        await inngest.send({
          name: "message.received",
          data: {
            orgId,
            conversationId: conversation.id,
            messageId: insertedMsg.id,
            correlationId,
          },
        });
      }

      logger.info("Chatwoot webhook processed", { ...ctx, orgId, conversationId: conversation.id });
    } catch (err) {
      logger.error("Chatwoot webhook processing error", { ...ctx, error: String(err) });
      await db.from("webhook_failures").insert({
        payload: msg,
        error: String(err),
      });
    }
  }

  return NextResponse.json({ status: "ok" });
}
