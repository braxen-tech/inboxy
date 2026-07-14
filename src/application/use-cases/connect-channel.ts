import type { SupabaseClient } from "@supabase/supabase-js";
import type { SecretStore } from "@/domain/ports";
import type { ChannelType } from "@/domain/value-objects";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { graphGet } from "@/infrastructure/adapters/meta/graph-client";
import { logger } from "@/lib/logger";

export interface ConnectChannelInput {
  orgId: string;
  type: ChannelType;
  /** System user access token obtained via Embedded Signup exchange. */
  accessToken: string;
  /** Optional business identifier from ES payload. */
  metaBusinessId?: string | null;
  /** WhatsApp Business Account id (required when type = whatsapp). */
  wabaId?: string | null;
  /** Instagram business account id (required when type = instagram). */
  igUserId?: string | null;
}

export interface ConnectChannelOutput {
  channelId: string;
  webhookVerifyToken: string;
  /** For WhatsApp: the display phone number that was registered. */
  phoneNumber?: string;
}

export interface ConnectChannelError {
  code: "META_API_ERROR" | "MISSING_INPUT" | "DB_ERROR";
  message: string;
}

/**
 * Persists a Meta channel connection after Embedded Signup v4 exchanges the code
 * for an access token. Looks up WABA phone_number_id or IG user profile from the
 * Graph API and stores an encrypted token.
 */
export async function connectChannel(
  db: SupabaseClient,
  secretStore: SecretStore,
  input: ConnectChannelInput,
): Promise<Result<ConnectChannelOutput, ConnectChannelError>> {
  const encryptedToken = secretStore.encrypt(input.accessToken);
  const verifyToken =
    process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ??
    // Deterministic per-org fallback in case the shared env token isn't set
    `inboxy-verify-${input.orgId}`;

  if (input.type === "whatsapp") {
    if (!input.wabaId) {
      return Err({ code: "MISSING_INPUT", message: "wabaId é obrigatório para WhatsApp." });
    }

    // Get phone numbers registered under the WABA
    const phonesRes = await graphGet<{
      data?: Array<{ id: string; display_phone_number?: string; verified_name?: string }>;
    }>(`/${input.wabaId}/phone_numbers`, input.accessToken);

    if (!phonesRes.ok) {
      return Err({ code: "META_API_ERROR", message: phonesRes.error.message });
    }

    const phone = phonesRes.data.data?.[0];
    if (!phone) {
      return Err({ code: "META_API_ERROR", message: "Nenhum número de telefone encontrado no WABA." });
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

  // Instagram
  if (!input.igUserId) {
    return Err({ code: "MISSING_INPUT", message: "igUserId é obrigatório para Instagram." });
  }

  const igRes = await graphGet<{ id?: string; username?: string; name?: string }>(
    `/${input.igUserId}?fields=id,username,name`,
    input.accessToken,
  );

  if (!igRes.ok) {
    return Err({ code: "META_API_ERROR", message: igRes.error.message });
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

/** Disconnect (soft) a channel — clears token and flips status. */
export async function disconnectChannel(
  db: SupabaseClient,
  orgId: string,
  channelId: string,
): Promise<Result<{ ok: true }, ConnectChannelError>> {
  const { error } = await db
    .from("channels")
    .update({ status: "disconnected", access_token: null, connected_at: null })
    .eq("id", channelId)
    .eq("organization_id", orgId);

  if (error) {
    return Err({ code: "DB_ERROR", message: error.message });
  }

  return Ok({ ok: true });
}
