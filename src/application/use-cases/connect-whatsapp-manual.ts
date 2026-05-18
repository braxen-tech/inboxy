import type { SupabaseClient } from "@supabase/supabase-js";
import type { SecretStore } from "@/domain/ports";
import { Ok, Err, type Result } from "@/domain/errors";
import { DomainError } from "@/domain/errors";
import { getPhoneNumber, subscribeApp } from "@/infrastructure/adapters/whatsapp-cloud/graph-client";
import { logger } from "@/lib/logger";

interface ManualConnectInput {
  orgId: string;
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
}

interface ManualConnectOutput {
  displayPhoneNumber: string;
}

/**
 * MVP: cliente cola token + IDs do WhatsApp Cloud API no dashboard (sem Embedded Signup).
 */
export async function connectWhatsAppManual(
  db: SupabaseClient,
  secretStore: SecretStore,
  input: ManualConnectInput,
): Promise<Result<ManualConnectOutput, DomainError>> {
  const wabaId = input.wabaId.trim();
  const phoneNumberId = input.phoneNumberId.trim();
  const accessToken = input.accessToken.trim();
  const { orgId } = input;
  const ctx = { orgId };

  if (!wabaId || !phoneNumberId || !accessToken) {
    return Err(new DomainError("ORG_WHATSAPP_DISCONNECTED", "Preencha WABA ID, Phone number ID e access token."));
  }

  const phoneResult = await getPhoneNumber(phoneNumberId, accessToken);
  if (!phoneResult.ok) {
    logger.error("Manual connect: invalid token or phone id", { ...ctx, error: phoneResult.error });
    return Err(
      new DomainError(
        "ORG_WHATSAPP_DISCONNECTED",
        `Token ou Phone number ID inválido: ${phoneResult.error.message}`,
      ),
    );
  }

  const { display_phone_number, verified_name } = phoneResult.data;

  const sub = await subscribeApp(wabaId, accessToken);
  if (!sub.ok) {
    logger.warn("Manual connect: subscribed_apps failed (pode já estar inscrito)", {
      ...ctx,
      error: sub.error.message,
    });
  }

  const { error: updateError } = await db
    .from("organizations")
    .update({
      whatsapp_business_account_id: wabaId,
      whatsapp_phone_number_id: phoneNumberId,
      whatsapp_phone_number: display_phone_number ?? null,
      whatsapp_access_token: secretStore.encrypt(accessToken),
      whatsapp_pin: null,
      whatsapp_status: "active",
    })
    .eq("id", orgId);

  if (updateError) {
    logger.error("Manual connect: DB update failed", { ...ctx, error: updateError.message });
    return Err(new DomainError("ORG_WHATSAPP_DISCONNECTED", "Falha ao salvar credenciais."));
  }

  logger.info("WhatsApp manual connect saved", {
    ...ctx,
    phone: display_phone_number,
    verifiedName: verified_name,
  });
  return Ok({ displayPhoneNumber: display_phone_number });
}
