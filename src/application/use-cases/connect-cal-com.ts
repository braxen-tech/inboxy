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
  bookingUrl: string;
}

export async function connectCalCom(
  db: SupabaseClient,
  secretStore: SecretStore,
  calendarProvider: CalendarProvider,
  input: ConnectCalComInput,
): Promise<Result<{ validated: true }, DomainError>> {
  const { orgId, apiKey, eventTypeId, timezone, bookingUrl } = input;
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

  const encryptedKey = secretStore.encrypt(apiKey);

  const calTools = ["check_calendar_availability", "book_calendar_appointment"];

  const { data: currentOrg } = await db
    .from("organizations")
    .select("tools_enabled")
    .eq("id", orgId)
    .single();

  const existingTools: string[] = currentOrg?.tools_enabled ?? [];
  const mergedTools = Array.from(new Set([...existingTools, ...calTools]));

  const { error: updateError } = await db
    .from("organizations")
    .update({
      cal_api_key: encryptedKey,
      cal_event_type_id: eventTypeId,
      cal_timezone: timezone,
      cal_booking_url: bookingUrl || null,
      cal_status: "active",
      tools_enabled: mergedTools,
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
  const calTools = ["check_calendar_availability", "book_calendar_appointment"];

  const { data: currentOrg } = await db
    .from("organizations")
    .select("tools_enabled")
    .eq("id", orgId)
    .single();

  const existingTools: string[] = currentOrg?.tools_enabled ?? [];
  const filteredTools = existingTools.filter((t) => !calTools.includes(t));

  const { error } = await db
    .from("organizations")
    .update({
      cal_api_key: null,
      cal_event_type_id: null,
      cal_booking_url: null,
      cal_status: "disconnected",
      tools_enabled: filteredTools,
    })
    .eq("id", orgId);

  if (error) {
    return Err(new DomainError("CALENDAR_SLOTS_FAILED", error.message));
  }

  return Ok({ disconnected: true });
}
