import type { SupabaseClient } from "@supabase/supabase-js";
import { Ok, Err, type Result } from "@/domain/errors";
import { DomainError } from "@/domain/errors";
import { createStripeConnectedAccount, syncAccountStatus } from "@/infrastructure/adapters/stripe";
import { logger } from "@/lib/logger";

export async function provisionStripeConnectedAccount(
  db: SupabaseClient,
  orgId: string,
  email: string,
): Promise<Result<{ accountId: string }, DomainError>> {
  const { data: org } = await db
    .from("organizations")
    .select("stripe_account_id, stripe_account_status")
    .eq("id", orgId)
    .single();

  // Idempotent — if account already exists, just return it.
  if (org?.stripe_account_id) {
    return Ok({ accountId: org.stripe_account_id });
  }

  try {
    const { accountId, status } = await createStripeConnectedAccount(orgId, email);

    const { error: updateError } = await db
      .from("organizations")
      .update({
        stripe_account_id: accountId,
        stripe_account_status: status,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
      })
      .eq("id", orgId);

    if (updateError) {
      logger.error("Stripe connect: DB update failed", { orgId, error: updateError.message });
      return Err(new DomainError("STRIPE_CONNECT_FAILED", "Erro ao salvar configuração."));
    }

    logger.info("Stripe Connected Account provisioned", { orgId, accountId });
    return Ok({ accountId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("Stripe connected account creation failed", { orgId, error: msg });
    return Err(new DomainError("STRIPE_CONNECT_FAILED", `Erro ao criar conta Stripe: ${msg}`));
  }
}

export async function refreshStripeAccountStatus(
  db: SupabaseClient,
  orgId: string,
): Promise<Result<{ status: string }, DomainError>> {
  const { data: org } = await db
    .from("organizations")
    .select("stripe_account_id")
    .eq("id", orgId)
    .single();

  if (!org?.stripe_account_id) {
    return Err(new DomainError("STRIPE_CONNECT_FAILED", "Conta Stripe não encontrada."));
  }

  try {
    const status = await syncAccountStatus(db, orgId, org.stripe_account_id);
    return Ok({ status });
  } catch (error) {
    logger.error("Stripe account status sync failed", { orgId, error: String(error) });
    return Err(new DomainError("STRIPE_CONNECT_FAILED", "Erro ao verificar status da conta."));
  }
}

export async function disconnectStripe(
  db: SupabaseClient,
  orgId: string,
): Promise<Result<{ disconnected: true }, DomainError>> {
  const { error } = await db
    .from("organizations")
    .update({
      stripe_account_id: null,
      stripe_account_status: "pending",
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
    })
    .eq("id", orgId);

  if (error) {
    return Err(new DomainError("STRIPE_CONNECT_FAILED", error.message));
  }

  return Ok({ disconnected: true });
}
