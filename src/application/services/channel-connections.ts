import type { SupabaseClient } from "@supabase/supabase-js";
import type { InboundMessage, NativeChannelKind, SecretStore, SendTarget } from "@/domain/ports";
import type { ConversationKey } from "@/application/services/inbound-message";

export type ChannelConnectionStatus = "pending" | "active" | "disconnected" | "error";

export interface WhatsAppCloudConfig {
  phone_number_id: string;
  waba_id?: string | null;
  display_phone_number?: string | null;
  verified_name?: string | null;
  access_token_enc: string;
  app_secret_enc: string;
}

export interface TelegramConfig {
  bot_id: string;
  bot_username?: string | null;
  bot_token_enc: string;
}

export type ChannelConnection =
  | ConnectionBase<"whatsapp_cloud", WhatsAppCloudConfig>
  | ConnectionBase<"telegram", TelegramConfig>;

interface ConnectionBase<K extends NativeChannelKind, C> {
  id: string;
  organization_id: string;
  channel: K;
  status: ChannelConnectionStatus;
  config: C;
  webhook_secret: string;
}

export async function getChannelConnection(
  db: SupabaseClient,
  id: string,
): Promise<ChannelConnection | null> {
  const { data } = await db
    .from("channel_connections")
    .select("id, organization_id, channel, status, config, webhook_secret")
    .eq("id", id)
    .maybeSingle();
  return (data as ChannelConnection | null) ?? null;
}

/** Secret the adapter checks on inbound webhooks: Meta app secret (HMAC) or Telegram secret_token. */
export function inboundWebhookSecret(conn: ChannelConnection, secretStore: SecretStore): string {
  return conn.channel === "whatsapp_cloud"
    ? secretStore.decrypt(conn.config.app_secret_enc)
    : conn.webhook_secret;
}

export function buildSendTarget(
  conn: ChannelConnection,
  secretStore: SecretStore,
  externalContactId: string,
): SendTarget {
  if (conn.channel === "whatsapp_cloud") {
    return {
      kind: "whatsapp_cloud",
      phoneNumberId: conn.config.phone_number_id,
      accessToken: secretStore.decrypt(conn.config.access_token_enc),
      to: externalContactId,
    };
  }
  return {
    kind: "telegram",
    botToken: secretStore.decrypt(conn.config.bot_token_enc),
    chatId: externalContactId,
  };
}

/** Maps a parsed inbound message to the ingest parameters for its connection. */
export function nativeIngestParams(conn: ChannelConnection, msg: InboundMessage): {
  key: ConversationKey;
  eventId: string;
  source: string;
  contactIdentifier: string;
  contactMetadata: Record<string, unknown>;
} {
  const key: ConversationKey = {
    kind: "connection",
    connectionId: conn.id,
    channel: conn.channel,
    externalContactId: msg.externalConversationId,
  };

  if (conn.channel === "whatsapp_cloud") {
    return {
      key,
      // wamid is globally unique.
      eventId: `wa:${msg.externalMessageId}`,
      source: "whatsapp_cloud",
      contactIdentifier: msg.senderPhone ?? `+${msg.externalConversationId}`,
      contactMetadata: { whatsapp_wa_id: msg.externalConversationId },
    };
  }

  return {
    key,
    eventId: `tg:${conn.id}:${msg.externalMessageId}`,
    source: "telegram",
    contactIdentifier: msg.senderPhone ?? `tg:${msg.senderExternalId ?? msg.externalConversationId}`,
    contactMetadata: { telegram_user_id: msg.senderExternalId },
  };
}
