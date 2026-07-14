import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { TelegramBotAdapter } from "@/infrastructure/adapters/telegram-bot";
import { processChannelInboundMessage } from "@/application/services/channel-inbound";
import { logger } from "@/lib/logger";
import { logWebhookHandled, logWebhookIgnored } from "@/lib/operational-telemetry";
import { captureServerException } from "@/lib/posthog-server";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

const WEBHOOK = "telegram";
const adapter = new TelegramBotAdapter();

function safeEqual(a: string, b: string): boolean {
  const buflen = Buffer.byteLength(a);
  if (buflen !== Buffer.byteLength(b)) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Telegram Bot webhook — secret checked via X-Telegram-Bot-Api-Secret-Token.
 * Channel is resolved from the URL (one webhook URL per connected bot).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  scheduleTelemetryFlush();

  const { channelId } = await context.params;
  if (!channelId) {
    return NextResponse.json({ error: "missing_channel" }, { status: 400 });
  }

  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const rawBody = await request.text();

  const db = getAdminClient();
  const { data: channel } = await db
    .from("channels")
    .select("id, organization_id, type, status, webhook_verify_token, telegram_bot_id")
    .eq("id", channelId)
    .eq("type", "telegram")
    .maybeSingle();

  if (!channel || channel.status !== "active") {
    logWebhookIgnored(WEBHOOK, "unknown_channel", { channelId });
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  const expected = channel.webhook_verify_token ?? "";
  if (!expected || !secretHeader || !safeEqual(secretHeader, expected)) {
    logger.warn("Telegram webhook secret mismatch", { channelId });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = await adapter.parseWebhook(rawBody, null, "");
  if (!parsed.ok) {
    if (parsed.error.code === "IGNORED_EVENT") {
      logWebhookIgnored(WEBHOOK, parsed.error.code, { message: parsed.error.message });
      return NextResponse.json({ status: "ignored", reason: parsed.error.message });
    }
    return NextResponse.json({ error: parsed.error.code }, { status: 400 });
  }

  for (const msg of parsed.value) {
    try {
      const enriched = {
        ...msg,
        recipientTelegramBotId: channel.telegram_bot_id,
      };
      await processChannelInboundMessage(db, channel, enriched);
      logWebhookHandled(WEBHOOK, "message_received", {
        channelType: "telegram",
        externalMessageId: msg.externalMessageId,
        orgId: channel.organization_id,
      });
    } catch (err) {
      logger.error("Telegram webhook processing error", { error: String(err), channelId });
      captureServerException(err);
      await db.from("webhook_failures").insert({
        payload: { channelId, msg },
        error: String(err),
      });
    }
  }

  return NextResponse.json({ status: "ok" });
}
