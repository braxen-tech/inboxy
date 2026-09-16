import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "./client";
import { logger } from "@/lib/logger";

export type ConnectedAccountStatus = "pending" | "onboarding" | "active" | "restricted" | "disabled";

export interface CreateConnectedAccountResult {
  accountId: string;
  status: ConnectedAccountStatus;
}

export async function createStripeConnectedAccount(
  orgId: string,
  email: string,
): Promise<CreateConnectedAccountResult> {
  const stripe = getStripe();

  const account = await stripe.v2.core.accounts.create({
    contact_email: email,
    display_name: `Org ${orgId}`,
    dashboard: "none",
    identity: {
      country: "BR",
    },
    defaults: {
      responsibilities: {
        fees_collector: "application",
        losses_collector: "stripe",
      },
    },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { requested: true },
        },
      },
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { requested: true },
          },
        },
      },
    },
    metadata: { orgId },
  });

  logger.info("Created Stripe Connected Account v2", { orgId, accountId: account.id });

  return { accountId: account.id, status: "onboarding" };
}

export async function createAccountSession(
  stripeAccountId: string,
  components: Record<string, unknown>,
): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.accountSessions.create({
    account: stripeAccountId,
    components: components as Parameters<typeof stripe.accountSessions.create>[0]["components"],
  });

  return session.client_secret;
}

export async function syncAccountStatus(
  db: SupabaseClient,
  orgId: string,
  stripeAccountId: string,
): Promise<ConnectedAccountStatus> {
  const stripe = getStripe();
  const account = await stripe.v2.core.accounts.retrieve(stripeAccountId);

  const merchant = account.configuration?.merchant;
  const cardStatus = merchant?.capabilities?.card_payments?.status;
  // In v2, applied_configurations includes "merchant" when onboarding is complete.
  // Sandbox capabilities never reach "active" automatically, so we use this instead.
  const merchantApplied = account.applied_configurations?.includes("merchant") ?? false;
  const chargesEnabled = merchantApplied || cardStatus === "active";

  logger.info("Stripe v2 account status", {
    orgId,
    accountId: stripeAccountId,
    applied_configurations: account.applied_configurations,
    merchant_applied: merchantApplied,
    card_payments_status: cardStatus,
  });

  const status: ConnectedAccountStatus = chargesEnabled
    ? "active"
    : merchant != null
      ? "onboarding"
      : "disabled";

  await db
    .from("organizations")
    .update({
      stripe_account_status: status,
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: chargesEnabled,
    })
    .eq("id", orgId);

  return status;
}
