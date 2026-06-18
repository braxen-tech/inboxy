import { NextResponse } from "next/server";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { parseChatwootWebhookPayload } from "@/infrastructure/adapters/chatwoot/webhook-events";
import {
  processChatwootInboundMessage,
  syncConversationStatusByChatwootId,
} from "@/application/services/chatwoot-inbound";
import { logger } from "@/lib/logger";
import { logWebhookHandled, logWebhookIgnored } from "@/lib/operational-telemetry";
import { captureServerException } from "@/lib/posthog-server";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

const WEBHOOK = "chatwoot/legacy";

/** Legacy account webhook — used only when org has no Agent Bot configured */
export async function POST(request: Request) {
  scheduleTelemetryFlush();
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") ?? "";

  const db = getAdminClient();
  const body = await request.text();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    logger.warn("Webhook invalid JSON", { webhook: WEBHOOK });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const accountId = String((payload.account as Record<string, unknown>)?.id ?? "");
  if (!accountId) {
    logWebhookIgnored(WEBHOOK, "no_account_id");
    return NextResponse.json({ status: "ignored", reason: "no account id" });
  }

  const { data: org } = await db
    .from("organizations")
    .select("id, chatwoot_webhook_secret, chatwoot_agent_bot_id")
    .eq("chatwoot_account_id", accountId)
    .eq("chatwoot_status", "active")
    .single();

  if (!org) {
    logWebhookIgnored(WEBHOOK, "unknown_account", { accountId });
    return NextResponse.json({ status: "ignored", reason: "unknown account" });
  }

  if (org.chatwoot_agent_bot_id) {
    logWebhookIgnored(WEBHOOK, "use_agent_bot_webhook", { accountId, orgId: org.id });
    return NextResponse.json({
      status: "ignored",
      reason: "use agent bot webhook",
    });
  }

  if (!org.chatwoot_webhook_secret || querySecret !== org.chatwoot_webhook_secret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  const event = parseChatwootWebhookPayload(
    payload as unknown as Parameters<typeof parseChatwootWebhookPayload>[0],
  );

  try {
    if (event.type === "ignored") {
      logWebhookIgnored(WEBHOOK, event.reason, { accountId, orgId: org.id });
      return NextResponse.json({ status: "ignored", reason: event.reason });
    }

    if (event.type === "conversation_updated") {
      await syncConversationStatusByChatwootId(
        db,
        org.id,
        event.chatwootConversationId,
        event.status,
      );
      logWebhookHandled(WEBHOOK, "conversation_updated", {
        accountId,
        orgId: org.id,
        chatwootConversationId: event.chatwootConversationId,
        status: event.status,
      });
      return NextResponse.json({ status: "ok" });
    }

    await processChatwootInboundMessage(db, org.id, event.message, {
      initialConversationStatus: event.conversationStatus,
    });

    logWebhookHandled(WEBHOOK, "message_received", {
      accountId,
      orgId: org.id,
      externalMessageId: event.message.externalMessageId,
    });
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    logger.error("Chatwoot account webhook error", { accountId, orgId: org.id, error: String(err) });
    captureServerException(err, { orgId: org.id });
    await db.from("webhook_failures").insert({ payload, error: String(err) });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
