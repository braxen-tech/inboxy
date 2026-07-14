import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SecretStore } from "@/domain/ports";
import type { ChannelType } from "@/domain/value-objects";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { graphGet, graphPost } from "@/infrastructure/adapters/meta/graph-client";
import {
  telegramDeleteWebhook,
  telegramGetMe,
  telegramSetWebhook,
} from "@/infrastructure/adapters/telegram-bot";
import { getAppUrl } from "@/lib/app-url";
import { logger } from "@/lib/logger";

/** Two-step verification PIN used when registering a Cloud API number (sets 2FA if unset). */
const DEFAULT_WA_REGISTER_PIN = "000000";

export interface ConnectChannelInput {
  orgId: string;
  type: ChannelType;
  /**
   * Provider credential:
   * - WhatsApp / Instagram: Meta system-user / page token from Embedded Signup
   * - Telegram: BotFather bot token
   */
  accessToken: string;
  metaBusinessId?: string | null;
  wabaId?: string | null;
  igUserId?: string | null;
}

export interface ConnectChannelOutput {
  channelId: string;
  webhookVerifyToken: string;
  phoneNumber?: string;
  botUsername?: string;
}

export interface ConnectChannelError {
  code: "PROVIDER_API_ERROR" | "MISSING_INPUT" | "DB_ERROR";
  message: string;
}

/**
 * Persists a messaging channel connection.
 * Meta channels use Embedded Signup tokens; Telegram uses a BotFather token + setWebhook.
 */
export async function connectChannel(
  db: SupabaseClient,
  secretStore: SecretStore,
  input: ConnectChannelInput,
): Promise<Result<ConnectChannelOutput, ConnectChannelError>> {
  if (input.type === "whatsapp") {
    return connectWhatsApp(db, secretStore, input);
  }
  if (input.type === "instagram") {
    return connectInstagram(db, secretStore, input);
  }
  if (input.type === "telegram") {
    return connectTelegram(db, secretStore, input);
  }
  return Err({ code: "MISSING_INPUT", message: `Tipo de canal não suportado: ${input.type}` });
}

async function connectWhatsApp(
  db: SupabaseClient,
  secretStore: SecretStore,
  input: ConnectChannelInput,
): Promise<Result<ConnectChannelOutput, ConnectChannelError>> {
  const encryptedToken = secretStore.encrypt(input.accessToken);
  const verifyToken =
    process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ?? `inboxy-verify-${input.orgId}`;

  if (!input.wabaId) {
    return Err({ code: "MISSING_INPUT", message: "wabaId é obrigatório para WhatsApp." });
  }

  const phonesRes = await graphGet<{
    data?: Array<{ id: string; display_phone_number?: string; verified_name?: string }>;
  }>(`/${input.wabaId}/phone_numbers`, input.accessToken);

  if (!phonesRes.ok) {
    return Err({ code: "PROVIDER_API_ERROR", message: phonesRes.error.message });
  }

  const phone = phonesRes.data.data?.[0];
  if (!phone) {
    return Err({
      code: "PROVIDER_API_ERROR",
      message: "Nenhum número de telefone encontrado no WABA.",
    });
  }

  const subscribeRes = await graphPost<{ success?: boolean }>(
    `/${input.wabaId}/subscribed_apps`,
    input.accessToken,
    {},
  );
  if (!subscribeRes.ok) {
    logger.error("Failed to subscribe WABA to webhooks", {
      orgId: input.orgId,
      wabaId: input.wabaId,
      error: subscribeRes.error.message,
    });
    return Err({
      code: "PROVIDER_API_ERROR",
      message: `Falha ao assinar webhooks do WABA: ${subscribeRes.error.message}`,
    });
  }

  const pin = process.env.META_WA_REGISTER_PIN?.trim() || DEFAULT_WA_REGISTER_PIN;
  const registerRes = await graphPost<{ success?: boolean }>(`/${phone.id}/register`, input.accessToken, {
    messaging_product: "whatsapp",
    pin,
  });
  if (!registerRes.ok) {
    const msg = registerRes.error.message.toLowerCase();
    const already = msg.includes("already registered") || msg.includes("already been registered");
    if (!already) {
      logger.error("Failed to register WhatsApp phone number", {
        orgId: input.orgId,
        phoneNumberId: phone.id,
        error: registerRes.error.message,
      });
      return Err({
        code: "PROVIDER_API_ERROR",
        message: `Falha ao registrar número no Cloud API: ${registerRes.error.message}`,
      });
    }
    logger.warn("WhatsApp phone already registered; continuing", { phoneNumberId: phone.id });
  }

  const upsert = {
    organization_id: input.orgId,
    type: "whatsapp" as const,
    status: "active" as const,
    meta_business_id: input.metaBusinessId ?? null,
    access_token: encryptedToken,
    webhook_verify_token: verifyToken,
    waba_id: input.wabaId,
    phone_number_id: phone.id,
    phone_number: phone.display_phone_number ?? null,
    display_name: phone.verified_name ?? null,
    connected_at: new Date().toISOString(),
    last_error: null,
  };

  const { data, error } = await db
    .from("channels")
    .upsert(upsert, { onConflict: "organization_id,type" })
    .select("id")
    .single();

  if (error || !data) {
    logger.error("Failed to upsert WhatsApp channel", { orgId: input.orgId, error });
    return Err({ code: "DB_ERROR", message: error?.message ?? "Falha ao salvar canal." });
  }

  return Ok({
    channelId: data.id,
    webhookVerifyToken: verifyToken,
    phoneNumber: phone.display_phone_number ?? undefined,
  });
}

async function connectInstagram(
  db: SupabaseClient,
  secretStore: SecretStore,
  input: ConnectChannelInput,
): Promise<Result<ConnectChannelOutput, ConnectChannelError>> {
  const encryptedToken = secretStore.encrypt(input.accessToken);
  const verifyToken =
    process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ?? `inboxy-verify-${input.orgId}`;

  if (!input.igUserId) {
    return Err({ code: "MISSING_INPUT", message: "igUserId é obrigatório para Instagram." });
  }

  const igRes = await graphGet<{ id?: string; username?: string; name?: string }>(
    `/${input.igUserId}?fields=id,username,name`,
    input.accessToken,
  );

  if (!igRes.ok) {
    return Err({ code: "PROVIDER_API_ERROR", message: igRes.error.message });
  }

  const upsert = {
    organization_id: input.orgId,
    type: "instagram" as const,
    status: "active" as const,
    meta_business_id: input.metaBusinessId ?? null,
    access_token: encryptedToken,
    webhook_verify_token: verifyToken,
    ig_user_id: input.igUserId,
    ig_username: igRes.data.username ?? null,
    display_name: igRes.data.name ?? igRes.data.username ?? null,
    connected_at: new Date().toISOString(),
    last_error: null,
  };

  const { data, error } = await db
    .from("channels")
    .upsert(upsert, { onConflict: "organization_id,type" })
    .select("id")
    .single();

  if (error || !data) {
    logger.error("Failed to upsert Instagram channel", { orgId: input.orgId, error });
    return Err({ code: "DB_ERROR", message: error?.message ?? "Falha ao salvar canal." });
  }

  return Ok({ channelId: data.id, webhookVerifyToken: verifyToken });
}

async function connectTelegram(
  db: SupabaseClient,
  secretStore: SecretStore,
  input: ConnectChannelInput,
): Promise<Result<ConnectChannelOutput, ConnectChannelError>> {
  const token = input.accessToken.trim();
  if (!token || !/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    return Err({
      code: "MISSING_INPUT",
      message: "Token do bot Telegram inválido. Cole o token gerado pelo @BotFather.",
    });
  }

  const me = await telegramGetMe(token);
  if (!me.ok) {
    return Err({
      code: "PROVIDER_API_ERROR",
      message: `Não foi possível validar o bot: ${me.error.message}`,
    });
  }

  const botId = String(me.data.id);
  const botUsername = me.data.username ?? null;
  const encryptedToken = secretStore.encrypt(token);
  // Telegram secret_token: 1-256 chars [A-Za-z0-9_-]
  const secretToken = randomBytes(32).toString("hex");

  const upsert = {
    organization_id: input.orgId,
    type: "telegram" as const,
    status: "active" as const,
    access_token: encryptedToken,
    webhook_verify_token: secretToken,
    telegram_bot_id: botId,
    display_name: botUsername ? `@${botUsername}` : me.data.first_name ?? "Telegram Bot",
    connected_at: new Date().toISOString(),
    last_error: null,
  };

  const { data, error } = await db
    .from("channels")
    .upsert(upsert, { onConflict: "organization_id,type" })
    .select("id")
    .single();

  if (error || !data) {
    logger.error("Failed to upsert Telegram channel", { orgId: input.orgId, error });
    return Err({ code: "DB_ERROR", message: error?.message ?? "Falha ao salvar canal." });
  }

  const webhookUrl = `${getAppUrl().replace(/\/$/, "")}/api/webhooks/telegram/${data.id}`;
  const setRes = await telegramSetWebhook(token, webhookUrl, secretToken);
  if (!setRes.ok) {
    logger.error("Failed to set Telegram webhook", {
      orgId: input.orgId,
      channelId: data.id,
      error: setRes.error.message,
    });
    await db
      .from("channels")
      .update({
        status: "error",
        last_error: setRes.error.message,
        access_token: null,
        connected_at: null,
      })
      .eq("id", data.id);
    return Err({
      code: "PROVIDER_API_ERROR",
      message: `Falha ao registrar webhook do Telegram: ${setRes.error.message}. Confira se NEXT_PUBLIC_APP_URL é HTTPS público.`,
    });
  }

  return Ok({
    channelId: data.id,
    webhookVerifyToken: secretToken,
    botUsername: botUsername ?? undefined,
  });
}

/** Disconnect a channel — for Telegram, best-effort deleteWebhook first. */
export async function disconnectChannel(
  db: SupabaseClient,
  orgId: string,
  channelId: string,
  deps: { secretStore?: SecretStore } = {},
): Promise<Result<{ ok: true }, ConnectChannelError>> {
  const { data: channel } = await db
    .from("channels")
    .select("id, type, access_token")
    .eq("id", channelId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (channel?.type === "telegram" && channel.access_token && deps.secretStore) {
    try {
      const token = deps.secretStore.decrypt(channel.access_token);
      await telegramDeleteWebhook(token);
    } catch (err) {
      logger.warn("Telegram deleteWebhook failed during disconnect", {
        channelId,
        error: String(err),
      });
    }
  }

  const { error } = await db
    .from("channels")
    .update({
      status: "disconnected",
      access_token: null,
      connected_at: null,
      webhook_verify_token: null,
      last_error: null,
    })
    .eq("id", channelId)
    .eq("organization_id", orgId);

  if (error) {
    return Err({ code: "DB_ERROR", message: error.message });
  }

  return Ok({ ok: true });
}
