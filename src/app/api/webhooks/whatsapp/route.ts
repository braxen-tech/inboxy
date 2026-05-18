import { NextResponse } from "next/server";
import { after } from "next/server";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { WhatsAppCloudAdapter } from "@/infrastructure/adapters/whatsapp-cloud/adapter";
import { ClaudeAdapter } from "@/infrastructure/adapters/claude/adapter";
import { InMemoryToolRegistry } from "@/infrastructure/tools/registry";
import { AesSecretStore } from "@/infrastructure/crypto/aes-secret-store";
import { processIncomingMessage } from "@/application/use-cases/process-incoming-message";
import { toOrgId, toContactId, toConversationId, toMessageId, toCorrelationId } from "@/domain/value-objects";
import { incrementUsage } from "@/application/services/usage-tracker";
import { logger } from "@/lib/logger";
import { randomUUID } from "node:crypto";

const adapter = new WhatsAppCloudAdapter();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET!;

  const verifyResult = await adapter.verifyWebhook(request, appSecret);
  if (!verifyResult.ok) {
    logger.warn("Webhook signature invalid", { error: verifyResult.error });
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const inboundMessages = adapter.parseInbound(verifyResult.value);
  if (inboundMessages.length === 0) {
    return NextResponse.json({ status: "ok" });
  }

  const db = getAdminClient();

  for (const msg of inboundMessages) {
    const correlationId = randomUUID();
    const ctx = { correlationId, whatsappMessageId: msg.whatsappMessageId };

    try {
      // Idempotency: check processed_webhook_events
      const { data: existing } = await db
        .from("processed_webhook_events")
        .select("event_id")
        .eq("event_id", msg.whatsappMessageId)
        .single();

      if (existing) {
        logger.info("Duplicate webhook event, skipping", ctx);
        continue;
      }

      // Resolve org by phone_number_id
      const { data: org } = await db
        .from("organizations")
        .select("id")
        .eq("whatsapp_phone_number_id", msg.phoneNumberId)
        .eq("whatsapp_status", "active")
        .single();

      if (!org) {
        logger.warn("No active org for phone_number_id", { ...ctx, phoneNumberId: msg.phoneNumberId });
        continue;
      }

      const orgId = org.id;

      // Upsert contact
      const { data: contact } = await db
        .from("contacts")
        .upsert(
          { organization_id: orgId, phone: msg.from, profile_name: msg.profileName },
          { onConflict: "organization_id,phone" },
        )
        .select("id")
        .single();

      if (!contact) {
        logger.error("Contact upsert failed", ctx);
        continue;
      }

      // Upsert conversation
      let { data: conversation } = await db
        .from("conversations")
        .select("id, status")
        .eq("organization_id", orgId)
        .eq("contact_id", contact.id)
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

      // Insert message (idempotent via whatsapp_message_id UNIQUE)
      const { data: insertedMsg, error: msgError } = await db
        .from("messages")
        .insert({
          organization_id: orgId,
          conversation_id: conversation.id,
          direction: "inbound",
          content: msg.content,
          whatsapp_message_id: msg.whatsappMessageId,
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

      // Mark as processed
      await db.from("processed_webhook_events").insert({
        event_id: msg.whatsappMessageId,
        source: "whatsapp",
      });

      await incrementUsage(db, orgId, { messagesIn: 1 });

      if (conversation.status !== "human") {
        const capturedCtx = {
          orgId,
          conversationId: conversation.id,
          messageId: insertedMsg.id,
          correlationId,
        };
        after(async () => {
          try {
            const bgDb = getAdminClient();
            const secretStore = new AesSecretStore(process.env.ENCRYPTION_KEY!);
            await processIncomingMessage(
              {
                db: bgDb,
                agentRunner: new ClaudeAdapter(),
                messagingChannel: new WhatsAppCloudAdapter(),
                toolRegistry: new InMemoryToolRegistry(),
                secretStore,
              },
              capturedCtx,
            );
          } catch (err) {
            logger.error("Background message processing failed", {
              ...capturedCtx,
              error: String(err),
            });
            const bgDb = getAdminClient();
            await bgDb.from("webhook_failures").insert({
              payload: capturedCtx,
              error: String(err),
            });
          }
        });
      }

      logger.info("Webhook processed", { ...ctx, orgId, conversationId: conversation.id });
    } catch (err) {
      logger.error("Webhook processing error", { ...ctx, error: String(err) });
      await db.from("webhook_failures").insert({
        payload: msg,
        error: String(err),
      });
    }
  }

  return NextResponse.json({ status: "ok" });
}
