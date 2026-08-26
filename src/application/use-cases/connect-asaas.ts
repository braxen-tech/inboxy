import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SecretStore } from "@/domain/ports";
import { Ok, Err, type Result } from "@/domain/errors";
import { DomainError } from "@/domain/errors";
import { createSubaccount, createWebhook, AsaasApiError } from "@/infrastructure/adapters/asaas";
import { logger } from "@/lib/logger";

interface ProvisionAsaasSubaccountInput {
  orgId: string;
  name: string;
  email: string;
  cpfCnpj: string;
  companyType: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
  mobilePhone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
}

export async function provisionAsaasSubaccount(
  db: SupabaseClient,
  secretStore: SecretStore,
  input: ProvisionAsaasSubaccountInput,
): Promise<Result<{ walletId: string }, DomainError>> {
  const { orgId, ...accountInput } = input;
  const ctx = { orgId };

  const platformApiKey = process.env.ASAAS_API_KEY?.trim();
  if (!platformApiKey) {
    return Err(new DomainError("ASAAS_CONNECT_FAILED", "ASAAS_API_KEY não configurada no servidor."));
  }

  let subaccount;
  try {
    subaccount = await createSubaccount(platformApiKey, accountInput);
  } catch (error) {
    if (error instanceof AsaasApiError) {
      logger.error("Asaas subaccount creation failed", { ...ctx, status: error.status, body: error.body });
      return Err(new DomainError("ASAAS_CONNECT_FAILED", `Erro ao criar subconta Asaas: ${JSON.stringify(error.body)}`));
    }
    logger.error("Asaas subaccount creation failed", { ...ctx, error: String(error) });
    return Err(new DomainError("ASAAS_CONNECT_FAILED", "Erro ao criar subconta Asaas."));
  }

  // Each Asaas account (including subcontas) manages its own webhooks — without this,
  // payment confirmations never reach us and purchases stay "pending" forever.
  const webhookToken = randomBytes(32).toString("hex");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    await createWebhook(subaccount.apiKey, {
      name: "Inboxy",
      url: `${appUrl}/api/webhooks/asaas/${orgId}`,
      email: accountInput.email,
      authToken: webhookToken,
    });
  } catch (error) {
    if (error instanceof AsaasApiError) {
      logger.error("Asaas webhook registration failed", { ...ctx, status: error.status, body: error.body });
    } else {
      logger.error("Asaas webhook registration failed", { ...ctx, error: String(error) });
    }
    return Err(new DomainError("ASAAS_CONNECT_FAILED", "Subconta criada, mas falha ao registrar o webhook de pagamentos. Contate o suporte."));
  }

  const { error: updateError } = await db
    .from("organizations")
    .update({
      asaas_subconta_id: subaccount.id,
      asaas_wallet_id: subaccount.walletId,
      asaas_api_key_enc: secretStore.encrypt(subaccount.apiKey),
      asaas_webhook_token_enc: secretStore.encrypt(webhookToken),
      asaas_status: "active",
    })
    .eq("id", orgId);

  if (updateError) {
    logger.error("Asaas connect: DB update failed", { ...ctx, error: updateError.message });
    return Err(new DomainError("ASAAS_CONNECT_FAILED", "Erro ao salvar configuração."));
  }

  logger.info("Asaas subaccount provisioned", { ...ctx, subaccountId: subaccount.id });
  return Ok({ walletId: subaccount.walletId });
}

export async function disconnectAsaas(
  db: SupabaseClient,
  orgId: string,
): Promise<Result<{ disconnected: true }, DomainError>> {
  const { error } = await db
    .from("organizations")
    .update({
      asaas_subconta_id: null,
      asaas_wallet_id: null,
      asaas_api_key_enc: null,
      asaas_webhook_token_enc: null,
      asaas_status: "pending",
    })
    .eq("id", orgId);

  if (error) {
    return Err(new DomainError("ASAAS_CONNECT_FAILED", error.message));
  }

  return Ok({ disconnected: true });
}
