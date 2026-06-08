import { NextResponse } from "next/server";
import { linkBotToInbox } from "@/application/services/chatwoot-agent-bot-provision";
import { ChatwootClient } from "@/infrastructure/adapters/chatwoot/client";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { AesSecretStore, isValidEncryptionKeyHex } from "@/infrastructure/crypto/aes-secret-store";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";

interface InboxCreatedPayload {
  event: string;
  account?: { id: number };
  inbox?: { id: number; name?: string };
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") ?? "";

  const db = getAdminClient();
  const body = await request.text();

  let payload: InboxCreatedPayload;
  try {
    payload = JSON.parse(body) as InboxCreatedPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.event !== "inbox_created") {
    return NextResponse.json({ status: "ignored", reason: payload.event });
  }

  const accountId = String(payload.account?.id ?? "");
  const inboxId = payload.inbox?.id;

  if (!accountId || inboxId == null) {
    return NextResponse.json({ status: "ignored", reason: "missing account or inbox" });
  }

  const { data: org } = await db
    .from("organizations")
    .select(
      "id, chatwoot_api_url, chatwoot_api_token, chatwoot_account_id, chatwoot_webhook_secret, chatwoot_agent_bot_id, chatwoot_status",
    )
    .eq("chatwoot_account_id", accountId)
    .eq("chatwoot_status", "active")
    .single();

  if (!org?.chatwoot_webhook_secret || querySecret !== org.chatwoot_webhook_secret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  if (!org.chatwoot_agent_bot_id || !org.chatwoot_api_url || !org.chatwoot_api_token) {
    return NextResponse.json({ status: "ignored", reason: "agent bot not configured" });
  }

  const key = process.env.ENCRYPTION_KEY?.trim() ?? "";
  if (!isValidEncryptionKeyHex(key)) {
    logger.error("account-events: invalid ENCRYPTION_KEY");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let apiToken: string;
  try {
    apiToken = new AesSecretStore(key).decrypt(org.chatwoot_api_token);
  } catch {
    return NextResponse.json({ error: "Cannot decrypt token" }, { status: 500 });
  }

  const client = new ChatwootClient(org.chatwoot_api_url, apiToken);
  const botId = Number(org.chatwoot_agent_bot_id);

  const link = await linkBotToInbox(client, accountId, inboxId, botId);

  if (!link.ok) {
    logger.warn("inbox_created: failed to link bot", {
      orgId: org.id,
      inboxId,
      error: link.error,
    });
    return NextResponse.json({ status: "error", error: link.error }, { status: 502 });
  }

  logger.info("inbox_created: linked agent bot to inbox", {
    orgId: org.id,
    inboxId,
    inboxName: payload.inbox?.name,
    botId,
  });

  captureServerEvent("chatwoot_inbox_created", {
    orgId: org.id,
    inbox_id: inboxId,
    inbox_name: payload.inbox?.name,
  });

  return NextResponse.json({ status: "ok", inboxId, botId });
}
