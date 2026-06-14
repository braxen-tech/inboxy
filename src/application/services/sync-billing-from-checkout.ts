import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  subscriptionFieldsFromStripe,
} from "@/infrastructure/adapters/stripe/billing-adapter";
import { createPlatformStripeClient } from "@/infrastructure/adapters/stripe/platform-client";
import { logger } from "@/lib/logger";

export async function activateOrgFromCheckoutSession(
  db: SupabaseClient,
  session: Stripe.Checkout.Session,
  expectedOrgId?: string,
): Promise<boolean> {
  const orgId =
    session.metadata?.org_id ??
    session.client_reference_id ??
    null;

  if (!orgId) {
    logger.warn("checkout session missing org_id", { sessionId: session.id });
    return false;
  }

  if (expectedOrgId && orgId !== expectedOrgId) {
    logger.warn("checkout session org mismatch", {
      sessionId: session.id,
      expectedOrgId,
      orgId,
    });
    return false;
  }

  if (session.status !== "complete") {
    return false;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    logger.warn("checkout session has no subscription", { orgId, sessionId: session.id });
    return false;
  }

  const stripe = createPlatformStripeClient();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const fields = subscriptionFieldsFromStripe(sub);

  const { error } = await db.from("organizations").update(fields).eq("id", orgId);
  if (error) {
    throw new Error(error.message);
  }

  logger.info("Subscription synced from checkout session", { orgId, subscriptionId });
  return true;
}

export async function syncOrgFromCheckoutSessionId(
  db: SupabaseClient,
  sessionId: string,
  expectedOrgId: string,
): Promise<boolean> {
  const stripe = createPlatformStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return activateOrgFromCheckoutSession(db, session, expectedOrgId);
}

/** Fallback when webhooks miss (e.g. staging URL not registered in Stripe). */
export async function syncOrgBillingFromStripe(
  db: SupabaseClient,
  orgId: string,
): Promise<boolean> {
  const stripe = createPlatformStripeClient();
  const result = await stripe.subscriptions.search({
    query: `metadata["org_id"]:"${orgId}"`,
    limit: 1,
  });

  const sub = result.data[0];
  if (!sub || (sub.status !== "active" && sub.status !== "trialing")) {
    return false;
  }

  const fields = subscriptionFieldsFromStripe(sub);
  const { error } = await db.from("organizations").update(fields).eq("id", orgId);
  if (error) {
    throw new Error(error.message);
  }

  logger.info("Subscription synced from Stripe search", { orgId, subscriptionId: sub.id });
  return true;
}
