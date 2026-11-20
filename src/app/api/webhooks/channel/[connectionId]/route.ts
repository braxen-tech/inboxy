import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { createMessagingChannel } from "@/infrastructure/adapters/messaging-channel-factory";
import { AesSecretStore } from "@/infrastructure/crypto/aes-secret-store";
import {
  getChannelConnection,
  inboundWebhookSecret,
  nativeIngestParams,
} from "@/application/services/channel-connections";
import { ingestInboundMessage } from "@/application/services/inbound-message";
import { logger } from "@/lib/logger";
import { logWebhookHandled, logWebhookIgnored } from "@/lib/operational-telemetry";
import { captureServerException } from "@/lib/posthog-server";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

const WEBHOOK = "channel";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Ctx {
  params: Promise<{ connectionId: string }>;
}

function safeEqual(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Meta webhook verification handshake (WhatsApp Cloud API). */
export async function GET(request: Request, { params }: Ctx) {
  const { connectionId } = await params;
  if (!UUID_RE.test(connectionId)) return new NextResponse("Not found", { status: 404 });

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  const conn = await getChannelConnection(getAdminClient(), connectionId);
  if (!conn || conn.channel !== "whatsapp_cloud" || mode !== "subscribe" || !safeEqual(token, conn.webhook_secret)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: Request, { params }: Ctx) {
  scheduleTelemetryFlush();
  const { connectionId } = await params;
  if (!UUID_RE.test(connectionId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const encryptionKey = process.env.ENCRYPTION_KEY?.trim();
  if (!encryptionKey) {
    logger.error("ENCRYPTION_KEY is not set", { webhook: WEBHOOK });
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const secretStore = new AesSecretStore(encryptionKey);
  const db = getAdminClient();

  const conn = await getChannelConnection(db, connectionId);
  if (!conn || (conn.status !== "active" && conn.status !== "pending")) {
    logWebhookIgnored(WEBHOOK, "unknown_or_inactive_connection", { connectionId });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ctx = { connectionId, orgId: conn.organization_id, channel: conn.channel };
  const adapter = createMessagingChannel(conn.channel);

  let secret: string;
  try {
    secret = inboundWebhookSecret(conn, secretStore);
  } catch (err) {
    logger.error("Cannot decrypt channel webhook secret", { ...ctx, error: String(err) });
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const parsed = await adapter.parseWebhook(request, secret);
  if (!parsed.ok) {
    if (parsed.error.code === "SECRET_INVALID") {
      logger.warn("Channel webhook rejected", { ...ctx, reason: parsed.error.message });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    if (parsed.error.code === "PARSE_FAILED") {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    // Status updates, groups, edits: acknowledge so the provider doesn't retry.
    logWebhookIgnored(WEBHOOK, parsed.error.message, ctx);
    return NextResponse.json({ status: "ignored" });
  }

  try {
    for (const msg of parsed.value) {
      if (conn.channel === "whatsapp_cloud" && msg.accountId !== conn.config.phone_number_id) {
        logWebhookIgnored(WEBHOOK, "phone_number_mismatch", ctx);
        continue;
      }
      await ingestInboundMessage(db, {
        orgId: conn.organization_id,
        msg,
        ...nativeIngestParams(conn, msg),
      });
    }
    logWebhookHandled(WEBHOOK, "message_received", { ...ctx, count: parsed.value.length });
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    logger.error("Channel webhook error", { ...ctx, error: String(err) });
    captureServerException(err, { orgId: conn.organization_id });
    await db.from("webhook_failures").insert({
      payload: { connectionId, messages: parsed.value.map((m) => m.externalMessageId) },
      error: String(err),
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
