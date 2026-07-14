import { NextResponse } from "next/server";
import type { MessagingChannel } from "@/domain/ports";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { WhatsAppCloudAdapter } from "@/infrastructure/adapters/whatsapp-cloud";
import { InstagramDmAdapter } from "@/infrastructure/adapters/instagram-dm";
import { processMetaInboundMessage, resolveChannelForInbound } from "@/application/services/meta-inbound";
import { logger } from "@/lib/logger";
import { logWebhookHandled, logWebhookIgnored } from "@/lib/operational-telemetry";
import { captureServerException } from "@/lib/posthog-server";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

const WEBHOOK = "meta";
const whatsapp: MessagingChannel = new WhatsAppCloudAdapter();
const instagram: MessagingChannel = new InstagramDmAdapter();

/** Meta Webhook — GET verification handshake (WhatsApp + Instagram share this route) */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode") ?? "";
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!expected) {
    logger.error("META_WEBHOOK_VERIFY_TOKEN not configured");
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const result =
    whatsapp.verifyWebhook({ mode, token, challenge }, expected) ??
    instagram.verifyWebhook({ mode, token, challenge }, expected);

  if (!result) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(result, { status: 200 });
}

/** Meta Webhook — POST event delivery */
export async function POST(request: Request) {
  scheduleTelemetryFlush();

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    logger.error("META_APP_SECRET not configured");
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  const signature = request.headers.get("x-hub-signature-256");
  const rawBody = await request.text();

  // Route by top-level `object` field: "whatsapp_business_account" or "instagram"
  let object: string | undefined;
  try {
    object = (JSON.parse(rawBody) as { object?: string }).object;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const adapter: MessagingChannel | null =
    object === "whatsapp_business_account" ? whatsapp : object === "instagram" ? instagram : null;

  if (!adapter) {
    logWebhookIgnored(WEBHOOK, "unknown_object", { object });
    return NextResponse.json({ status: "ignored", reason: `unknown object: ${object}` });
  }

  const parsed = await adapter.parseWebhook(rawBody, signature, appSecret);
  if (!parsed.ok) {
    if (parsed.error.code === "SECRET_INVALID") {
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }
    if (parsed.error.code === "IGNORED_EVENT") {
      logWebhookIgnored(WEBHOOK, parsed.error.code, { message: parsed.error.message });
      return NextResponse.json({ status: "ignored", reason: parsed.error.message });
    }
    return NextResponse.json({ error: parsed.error.code }, { status: 400 });
  }

  const db = getAdminClient();

  for (const msg of parsed.value) {
    try {
      const channel = await resolveChannelForInbound(db, msg);
      if (!channel) {
        logWebhookIgnored(WEBHOOK, "unknown_channel", {
          channelType: msg.channelType,
          phoneNumberId: msg.recipientPhoneNumberId,
          igUserId: msg.recipientIgUserId,
        });
        continue;
      }

      await processMetaInboundMessage(db, channel, msg);
      logWebhookHandled(WEBHOOK, "message_received", {
        channelType: msg.channelType,
        externalMessageId: msg.externalMessageId,
        orgId: channel.organization_id,
      });
    } catch (err) {
      logger.error("Meta webhook processing error", { error: String(err) });
      captureServerException(err);
      await db.from("webhook_failures").insert({ payload: { object, msg }, error: String(err) });
    }
  }

  return NextResponse.json({ status: "ok" });
}
