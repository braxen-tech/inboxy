import type { SupabaseClient } from "@supabase/supabase-js";
import type { SecretStore } from "@/domain/ports";
import { Ok, Err, type Result } from "@/domain/errors";
import { DomainError } from "@/domain/errors";
import {
  exchangeCodeForToken,
  subscribeApp,
  registerPhoneNumber,
  getPhoneNumber,
} from "@/infrastructure/adapters/whatsapp-cloud/graph-client";
import { logger } from "@/lib/logger";
import { randomBytes } from "node:crypto";

interface ConnectInput {
  orgId: string;
  code: string;
  wabaId: string;
  phoneNumberId: string;
  appId: string;
  appSecret: string;
}

interface ConnectOutput {
  phoneNumber: string;
  verifiedName: string;
}

export async function connectWhatsApp(
  db: SupabaseClient,
  secretStore: SecretStore,
  input: ConnectInput,
): Promise<Result<ConnectOutput, DomainError>> {
  const { orgId, code, wabaId, phoneNumberId, appId, appSecret } = input;
  const ctx = { orgId };

  // 1. Exchange code for System User access token
  const tokenResult = await exchangeCodeForToken(code, appId, appSecret);
  if (!tokenResult.ok) {
    logger.error("Token exchange failed", { ...ctx, error: tokenResult.error });
    return Err(new DomainError("ORG_WHATSAPP_DISCONNECTED", "Failed to exchange code for access token"));
  }
  const accessToken = tokenResult.data.access_token;

  // 2. Subscribe our app to the WABA
  const subResult = await subscribeApp(wabaId, accessToken);
  if (!subResult.ok) {
    logger.error("App subscription failed", { ...ctx, error: subResult.error });
    return Err(new DomainError("ORG_WHATSAPP_DISCONNECTED", "Failed to subscribe app to WABA"));
  }

  // 3. Generate 2FA PIN and register number
  const pin = randomBytes(3).toString("hex").slice(0, 6);
  const regResult = await registerPhoneNumber(phoneNumberId, pin, accessToken);
  if (!regResult.ok) {
    logger.error("Phone registration failed", { ...ctx, error: regResult.error });
    return Err(new DomainError("ORG_WHATSAPP_DISCONNECTED", "Failed to register phone number"));
  }

  // 4. Get display phone number
  const phoneResult = await getPhoneNumber(phoneNumberId, accessToken);
  if (!phoneResult.ok) {
    logger.error("Get phone number failed", { ...ctx, error: phoneResult.error });
    return Err(new DomainError("ORG_WHATSAPP_DISCONNECTED", "Failed to get phone number details"));
  }

  const { display_phone_number, verified_name } = phoneResult.data;

  // 5. Persist (encrypted) to organization
  const { error: updateError } = await db
    .from("organizations")
    .update({
      whatsapp_business_account_id: wabaId,
      whatsapp_phone_number_id: phoneNumberId,
      whatsapp_phone_number: display_phone_number,
      whatsapp_access_token: secretStore.encrypt(accessToken),
      whatsapp_pin: secretStore.encrypt(pin),
      whatsapp_status: "active",
    })
    .eq("id", orgId);

  if (updateError) {
    logger.error("DB update failed during WhatsApp connect", { ...ctx, error: updateError.message });
    return Err(new DomainError("ORG_WHATSAPP_DISCONNECTED", "Failed to persist WhatsApp credentials"));
  }

  logger.info("WhatsApp connected", { ...ctx, phoneNumber: display_phone_number });
  return Ok({ phoneNumber: display_phone_number, verifiedName: verified_name });
}
