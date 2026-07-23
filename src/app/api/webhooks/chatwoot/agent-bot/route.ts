import { NextResponse } from "next/server";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { parseChatwootWebhookPayload } from "@/infrastructure/adapters/chatwoot/webhook-events";
import {
  processChatwootInboundMessage,
  syncConversationStatusByChatwootId,
} from "@/application/services/chatwoot-inbound";
import { logger } from "@/lib/logger";
import {
  logWebhookHandled,
  logWebhookIgnored,
} from "@/lib/operational-telemetry";
import { captureServerException } from "@/lib/posthog-server";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

const WEBHOOK = "chatwoot/agent-bot";

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
    .select("id, chatwoot_account_id, chatwoot_agent_bot_webhook_secret")
    .eq("chatwoot_account_id", accountId)
    .eq("chatwoot_status", "active")
    .maybeSingle();

  // Fallback: secret uniquely identifies the Inboxy org (helps diagnose account mismatches).
  let resolvedOrg = org;
  if (!resolvedOrg && querySecret) {
    const { data: bySecret } = await db
      .from("organizations")
      .select("id, chatwoot_account_id, chatwoot_agent_bot_webhook_secret")
      .eq("chatwoot_agent_bot_webhook_secret", querySecret)
      .eq("chatwoot_status", "active")
      .maybeSingle();
    if (bySecret) {
      logger.warn("Agent bot webhook account mismatch", {
        webhook: WEBHOOK,
        incomingAccountId: accountId,
        linkedAccountId: bySecret.chatwoot_account_id,
        orgId: bySecret.id,
      });
      // Do not process under the wrong Chatwoot account — replies would fail.
      logWebhookIgnored(WEBHOOK, "account_mismatch", {
        accountId,
        orgId: bySecret.id,
        linkedAccountId: bySecret.chatwoot_account_id ?? "",
      });
      return NextResponse.json({
        status: "ignored",
        reason: "account_mismatch",
        hint: `Webhook veio da conta Chatwoot ${accountId}, mas a org Inboxy está ligada à conta ${bySecret.chatwoot_account_id}. Reconecte o Chatwoot com a conta correta em Integrações.`,
      });
    }
  }

  if (!resolvedOrg?.chatwoot_agent_bot_webhook_secret) {
    logWebhookIgnored(WEBHOOK, "unknown_account", { accountId });
    return NextResponse.json({
      status: "ignored",
      reason: "unknown_account",
      hint: `Nenhuma org Inboxy ativa com chatwoot_account_id=${accountId}. Conecte essa conta em Integrações.`,
    });
  }

  if (querySecret !== resolvedOrg.chatwoot_agent_bot_webhook_secret) {
    logger.warn("Agent bot webhook secret mismatch", { accountId, orgId: resolvedOrg.id });
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  const orgForProcessing = resolvedOrg;

  const event = parseChatwootWebhookPayload(
    payload as unknown as Parameters<typeof parseChatwootWebhookPayload>[0],
  );

  try {
    if (event.type === "ignored") {
      logWebhookIgnored(WEBHOOK, event.reason, { accountId, orgId: orgForProcessing.id });
      return NextResponse.json({ status: "ignored", reason: event.reason });
    }

    if (event.type === "conversation_updated") {
      await syncConversationStatusByChatwootId(
        db,
        orgForProcessing.id,
        event.chatwootConversationId,
        event.status,
      );
      logWebhookHandled(WEBHOOK, "conversation_updated", {
        accountId,
        orgId: orgForProcessing.id,
        chatwootConversationId: event.chatwootConversationId,
        status: event.status,
      });
      return NextResponse.json({ status: "ok" });
    }

    await processChatwootInboundMessage(db, orgForProcessing.id, event.message, {
      initialConversationStatus: event.conversationStatus,
      requirePending: true,
      trustDbBotQueue: true,
    });

    logWebhookHandled(WEBHOOK, "message_received", {
      accountId,
      orgId: orgForProcessing.id,
      externalMessageId: event.message.externalMessageId,
      chatwootConversationId: event.message.chatwootConversationId,
      ...(event.message.chatwootChannel ? { chatwootChannel: event.message.chatwootChannel } : {}),
      ...(event.message.chatwootInboxId != null
        ? { chatwootInboxId: event.message.chatwootInboxId }
        : {}),
    });
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    logger.error("Agent bot webhook error", {
      accountId,
      orgId: orgForProcessing.id,
      error: String(err),
    });
    captureServerException(err, { orgId: orgForProcessing.id });
    await db.from("webhook_failures").insert({
      payload,
      error: String(err),
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
