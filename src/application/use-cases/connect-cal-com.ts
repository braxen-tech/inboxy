import type { SupabaseClient } from "@supabase/supabase-js";
import type { SecretStore, CalendarProvider } from "@/domain/ports";
import { Ok, Err, type Result } from "@/domain/errors";
import { DomainError } from "@/domain/errors";
import { logger } from "@/lib/logger";

interface ConnectCalComInput {
  orgId: string;
  apiKey: string;
  eventTypeId: string;
  timezone: string;
}

export async function connectCalCom(
  db: SupabaseClient,
  secretStore: SecretStore,
  calendarProvider: CalendarProvider,
  input: ConnectCalComInput,
): Promise<Result<{ validated: true }, DomainError>> {
  const { orgId, apiKey, eventTypeId, timezone } = input;
  const ctx = { orgId };

  if (!apiKey || !eventTypeId) {
    return Err(new DomainError("CALENDAR_SLOTS_FAILED", "Preencha API key e Event Type ID."));
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const slotsResult = await calendarProvider.listSlots({
    eventTypeId,
    startDate: today.toISOString().slice(0, 10),
    endDate: tomorrow.toISOString().slice(0, 10),
    timeZone: timezone,
    apiToken: apiKey,
  });

  if (!slotsResult.ok) {
    logger.error("Cal.com connect validation failed", { ...ctx, error: slotsResult.error });
    if (slotsResult.error.code === "AUTH_EXPIRED") {
      return Err(new DomainError("CALENDAR_SLOTS_FAILED", "API key inválida ou expirada."));
    }
    return Err(new DomainError("CALENDAR_SLOTS_FAILED", `Erro ao validar credencial: ${slotsResult.error.message}`));
  }

  const encryptedToken = secretStore.encrypt(apiKey);

  const { error: updateError } = await db
    .from("organizations")
    .update({
      cal_managed_user_id: 1, // placeholder: non-null = connected
      cal_access_token_enc: encryptedToken,
      cal_event_type_id: eventTypeId,
      cal_timezone: timezone,
    })
    .eq("id", orgId);

  if (updateError) {
    logger.error("Cal.com connect: DB update failed", { ...ctx, error: updateError.message });
    return Err(new DomainError("CALENDAR_SLOTS_FAILED", "Erro ao salvar configuração."));
  }

  logger.info("Cal.com connected", ctx);
  return Ok({ validated: true });
}

export async function disconnectCalCom(
  db: SupabaseClient,
  orgId: string,
): Promise<Result<{ disconnected: true }, DomainError>> {
  const { error } = await db
    .from("organizations")
    .update({
      cal_managed_user_id: null,
      cal_access_token_enc: null,
      cal_refresh_token_enc: null,
      cal_event_type_id: null,
      cal_timezone: null,
    })
    .eq("id", orgId);

  if (error) {
    return Err(new DomainError("CALENDAR_SLOTS_FAILED", error.message));
  }

  return Ok({ disconnected: true });
}
