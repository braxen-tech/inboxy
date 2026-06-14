import { NextResponse } from "next/server";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { parseChatwootWebhookPayload } from "@/infrastructure/adapters/chatwoot/webhook-events";
import {
  processChatwootInboundMessage,
  syncConversationStatusByChatwootId,
} from "@/application/services/chatwoot-inbound";
import { logger } from "@/lib/logger";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const accountId = String((payload.account as Record<string, unknown>)?.id ?? "");
  if (!accountId) {
    return NextResponse.json({ status: "ignored", reason: "no account id" });
  }

  const { data: org } = await db
    .from("organizations")
    .select("id, chatwoot_webhook_secret, chatwoot_agent_bot_id")
    .eq("chatwoot_account_id", accountId)
    .eq("chatwoot_status", "active")
    .single();

  if (!org) {
    return NextResponse.json({ status: "ignored", reason: "unknown account" });
  }

  if (org.chatwoot_agent_bot_id) {
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
      return NextResponse.json({ status: "ignored", reason: event.reason });
    }

    if (event.type === "conversation_updated") {
      await syncConversationStatusByChatwootId(
        db,
        org.id,
        event.chatwootConversationId,
        event.status,
      );
      return NextResponse.json({ status: "ok" });
    }

    await processChatwootInboundMessage(db, org.id, event.message, {
      initialConversationStatus: event.conversationStatus,
    });

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    logger.error("Chatwoot account webhook error", { accountId, error: String(err) });
    await db.from("webhook_failures").insert({ payload, error: String(err) });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
