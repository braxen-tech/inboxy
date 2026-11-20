import type { SupabaseClient } from "@supabase/supabase-js";
import type { NativeChannelKind, SecretStore } from "@/domain/ports";
import { Ok, Err, type Result } from "@/domain/errors";
import type { TelegramConfig, WhatsAppCloudConfig } from "@/application/services/channel-connections";
import { GRAPH_BASE_URL, fetchPhoneNumber } from "@/infrastructure/adapters/whatsapp-cloud/client";
import { deleteWebhook, getMe, setWebhook } from "@/infrastructure/adapters/telegram/client";
import { getAppUrl } from "@/lib/app-url";
import { logger } from "@/lib/logger";

export type ConnectChannelError =
  | { code: "INVALID_CREDENTIALS"; message: string }
  | { code: "WEBHOOK_SETUP_FAILED"; message: string }
  | { code: "DB_ERROR"; message: string };

export function buildChannelWebhookUrl(connectionId: string): string {
  return `${getAppUrl().replace(/\/+$/, "")}/api/webhooks/channel/${connectionId}`;
}

async function upsertConnection(
  db: SupabaseClient,
  orgId: string,
  channel: NativeChannelKind,
  config: WhatsAppCloudConfig | TelegramConfig,
  status: "pending" | "active",
): Promise<Result<{ id: string; webhook_secret: string }, ConnectChannelError>> {
  // webhook_secret is left out so reconnecting keeps the secret already registered upstream.
  const { data, error } = await db
    .from("channel_connections")
    .upsert(
      { organization_id: orgId, channel, config, status, last_error: null },
      { onConflict: "organization_id,channel" },
    )
    .select("id, webhook_secret")
    .single();
  if (error || !data) return Err({ code: "DB_ERROR", message: error?.message ?? "Upsert failed" });
  return Ok(data);
}

export interface ConnectWhatsAppInput {
  orgId: string;
  phoneNumberId: string;
  wabaId?: string;
  accessToken: string;
  appSecret: string;
}

export interface ConnectWhatsAppOutput {
  connectionId: string;
  webhookUrl: string;
  /** Paste into the Meta app's webhook "Verify token" field. */
  verifyToken: string;
  displayPhoneNumber: string | null;
}

export async function connectWhatsAppCloud(
  db: SupabaseClient,
  secretStore: SecretStore,
  input: ConnectWhatsAppInput,
): Promise<Result<ConnectWhatsAppOutput, ConnectChannelError>> {
  const phoneNumberId = input.phoneNumberId.trim();
  const accessToken = input.accessToken.trim();
  const appSecret = input.appSecret.trim();
  const ctx = { orgId: input.orgId, channel: "whatsapp_cloud" };

  const phone = await fetchPhoneNumber(phoneNumberId, accessToken);
  if (!phone.ok) {
    return Err({ code: "INVALID_CREDENTIALS", message: `Meta recusou as credenciais: ${phone.error}` });
  }

  const conn = await upsertConnection(
    db,
    input.orgId,
    "whatsapp_cloud",
    {
      phone_number_id: phoneNumberId,
      waba_id: input.wabaId?.trim() || null,
      display_phone_number: phone.data.display_phone_number ?? null,
      verified_name: phone.data.verified_name ?? null,
      access_token_enc: secretStore.encrypt(accessToken),
      app_secret_enc: secretStore.encrypt(appSecret),
    },
    "active",
  );
  if (!conn.ok) return conn;

  // Subscribes the app to the WABA's message events; harmless if already subscribed.
  if (input.wabaId?.trim()) {
    const res = await fetch(`${GRAPH_BASE_URL}/${encodeURIComponent(input.wabaId.trim())}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) logger.warn("WABA subscribed_apps failed", { ...ctx, status: res.status });
  }

  logger.info("WhatsApp Cloud connected", { ...ctx, connectionId: conn.value.id });
  return Ok({
    connectionId: conn.value.id,
    webhookUrl: buildChannelWebhookUrl(conn.value.id),
    verifyToken: conn.value.webhook_secret,
    displayPhoneNumber: phone.data.display_phone_number ?? null,
  });
}

export interface ConnectTelegramOutput {
  connectionId: string;
  botUsername: string | null;
}

export async function connectTelegram(
  db: SupabaseClient,
  secretStore: SecretStore,
  input: { orgId: string; botToken: string },
): Promise<Result<ConnectTelegramOutput, ConnectChannelError>> {
  const botToken = input.botToken.trim();
  const ctx = { orgId: input.orgId, channel: "telegram" };

  const me = await getMe(botToken);
  if (!me.ok) {
    return Err({ code: "INVALID_CREDENTIALS", message: "Token do bot inválido. Confira o token gerado pelo BotFather." });
  }

  const conn = await upsertConnection(
    db,
    input.orgId,
    "telegram",
    {
      bot_id: String(me.result.id),
      bot_username: me.result.username ?? null,
      bot_token_enc: secretStore.encrypt(botToken),
    },
    "pending",
  );
  if (!conn.ok) return conn;

  const hook = await setWebhook(botToken, buildChannelWebhookUrl(conn.value.id), conn.value.webhook_secret);
  if (!hook.ok) {
    const message = hook.description ?? "Telegram recusou o webhook";
    await db
      .from("channel_connections")
      .update({ status: "error", last_error: message })
      .eq("id", conn.value.id);
    logger.warn("Telegram setWebhook failed", { ...ctx, connectionId: conn.value.id, message });
    return Err({ code: "WEBHOOK_SETUP_FAILED", message });
  }

  await db.from("channel_connections").update({ status: "active" }).eq("id", conn.value.id);
  logger.info("Telegram connected", { ...ctx, connectionId: conn.value.id });
  return Ok({ connectionId: conn.value.id, botUsername: me.result.username ?? null });
}

export async function disconnectChannel(
  db: SupabaseClient,
  secretStore: SecretStore,
  input: { orgId: string; channel: NativeChannelKind },
): Promise<Result<void, ConnectChannelError>> {
  const { data: conn } = await db
    .from("channel_connections")
    .select("id, config")
    .eq("organization_id", input.orgId)
    .eq("channel", input.channel)
    .maybeSingle();
  if (!conn) return Ok(undefined);

  if (input.channel === "telegram") {
    try {
      await deleteWebhook(secretStore.decrypt((conn.config as TelegramConfig).bot_token_enc));
    } catch (err) {
      logger.warn("Telegram deleteWebhook failed", { orgId: input.orgId, error: String(err) });
    }
  }

  const { error } = await db
    .from("channel_connections")
    .update({ status: "disconnected" })
    .eq("id", conn.id);
  if (error) return Err({ code: "DB_ERROR", message: error.message });
  return Ok(undefined);
}
