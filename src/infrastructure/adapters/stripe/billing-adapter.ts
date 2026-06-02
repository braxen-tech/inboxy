import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingProvider, BillingError, Subscription } from "@/domain/ports/billing-provider";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import type { OrgId } from "@/domain/value-objects";
import { getTrialPeriodDays } from "@/lib/billing-setup";
import { PLANS, getStripePriceId, planFromStripePriceId, type PlanId } from "@/lib/plans";
import { getAppUrl } from "@/lib/app-url";
import { createPlatformStripeClient, getPlatformStripeSecretKey } from "./platform-client";
import { logger } from "@/lib/logger";
import type Stripe from "stripe";

function notConfigured(): Result<never, BillingError> {
  return Err({
    code: "NOT_CONFIGURED",
    message: "Stripe Billing não configurado no servidor (STRIPE_BILLING_SECRET_KEY).",
  });
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): Subscription["status"] {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "unpaid";
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return "past_due";
    default:
      return "past_due";
  }
}

export function subscriptionFieldsFromStripe(sub: Stripe.Subscription): {
  subscription_id: string;
  subscription_status: Subscription["status"];
  subscription_plan: PlanId;
  message_quota: number;
  subscription_current_period_end: string | null;
  stripe_customer_id: string;
} {
  const priceId = sub.items.data[0]?.price?.id;
  const plan = planFromStripePriceId(priceId) ?? "starter";
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? "";
  const periodEnd =
    sub.items.data[0]?.current_period_end ?? (sub as { current_period_end?: number }).current_period_end;

  return {
    subscription_id: sub.id,
    subscription_status: mapStripeSubscriptionStatus(sub.status),
    subscription_plan: plan,
    message_quota: PLANS[plan].messageQuota,
    subscription_current_period_end: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
    stripe_customer_id: customerId,
  };
}

export class StripeBillingAdapter implements BillingProvider {
  constructor(private db: SupabaseClient) {}

  async createCheckoutSession(
    orgId: OrgId,
    plan: PlanId,
    customerEmail: string,
  ): Promise<Result<string, BillingError>> {
    if (!getPlatformStripeSecretKey()) return notConfigured();

    try {
      const stripe = createPlatformStripeClient();
      const { data: org } = await this.db
        .from("organizations")
        .select("slug, stripe_customer_id")
        .eq("id", orgId)
        .single();

      if (!org) {
        return Err({ code: "CHECKOUT_FAILED", message: "Organização não encontrada." });
      }

      const appUrl = getAppUrl();
      const priceId = getStripePriceId(plan);

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/${org.slug}/billing?checkout=success`,
        cancel_url: `${appUrl}/${org.slug}/billing?checkout=canceled`,
        client_reference_id: orgId,
        metadata: { org_id: orgId, plan },
        subscription_data: {
          metadata: { org_id: orgId, plan },
          trial_period_days: getTrialPeriodDays(),
        },
        allow_promotion_codes: true,
      };

      if (org.stripe_customer_id) {
        sessionParams.customer = org.stripe_customer_id;
      } else {
        sessionParams.customer_email = customerEmail;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      if (!session.url) {
        return Err({ code: "CHECKOUT_FAILED", message: "Stripe não retornou URL de checkout." });
      }

      return Ok(session.url);
    } catch (error) {
      logger.error("Billing checkout failed", {
        orgId,
        plan,
        error: error instanceof Error ? error.message : String(error),
      });
      return Err({
        code: "CHECKOUT_FAILED",
        message: error instanceof Error ? error.message : "Falha ao criar checkout.",
      });
    }
  }

  async getSubscription(orgId: OrgId): Promise<Result<Subscription, BillingError>> {
    const { data: org } = await this.db
      .from("organizations")
      .select(
        "subscription_id, subscription_plan, subscription_status, message_quota, subscription_current_period_end, stripe_customer_id",
      )
      .eq("id", orgId)
      .single();

    if (!org) {
      return Err({ code: "SUBSCRIPTION_NOT_FOUND", message: "Organização não encontrada." });
    }

    if (!org.subscription_id || !getPlatformStripeSecretKey()) {
      const plan = (org.subscription_plan ?? "starter") as PlanId;
      return Ok({
        id: org.subscription_id ?? "",
        plan,
        status: (org.subscription_status ?? "trialing") as Subscription["status"],
        messageQuota: org.message_quota ?? PLANS[plan].messageQuota,
        currentPeriodEnd: org.subscription_current_period_end
          ? new Date(org.subscription_current_period_end)
          : null,
        stripeCustomerId: org.stripe_customer_id,
      });
    }

    try {
      const stripe = createPlatformStripeClient();
      const sub = await stripe.subscriptions.retrieve(org.subscription_id);
      const plan = planFromStripePriceId(sub.items.data[0]?.price?.id) ?? (org.subscription_plan as PlanId);

      return Ok({
        id: sub.id,
        plan,
        status: mapStripeSubscriptionStatus(sub.status),
        messageQuota: PLANS[plan].messageQuota,
        currentPeriodEnd: (() => {
          const end =
            sub.items.data[0]?.current_period_end ??
            (sub as { current_period_end?: number }).current_period_end;
          return end ? new Date(end * 1000) : null;
        })(),
        stripeCustomerId:
          typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null),
      });
    } catch (error) {
      logger.warn("Stripe subscription retrieve failed, using DB", {
        orgId,
        error: error instanceof Error ? error.message : String(error),
      });
      const plan = (org.subscription_plan ?? "starter") as PlanId;
      return Ok({
        id: org.subscription_id,
        plan,
        status: (org.subscription_status ?? "trialing") as Subscription["status"],
        messageQuota: org.message_quota ?? PLANS[plan].messageQuota,
        currentPeriodEnd: org.subscription_current_period_end
          ? new Date(org.subscription_current_period_end)
          : null,
        stripeCustomerId: org.stripe_customer_id,
      });
    }
  }

  async createPortalSession(orgId: OrgId): Promise<Result<string, BillingError>> {
    if (!getPlatformStripeSecretKey()) return notConfigured();

    const { data: org } = await this.db
      .from("organizations")
      .select("slug, stripe_customer_id")
      .eq("id", orgId)
      .single();

    if (!org?.stripe_customer_id) {
      return Err({
        code: "PORTAL_FAILED",
        message: "Nenhuma assinatura ativa. Assine um plano primeiro.",
      });
    }

    try {
      const stripe = createPlatformStripeClient();
      const appUrl = getAppUrl();
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: `${appUrl}/${org.slug}/billing`,
      });
      return Ok(session.url);
    } catch (error) {
      return Err({
        code: "PORTAL_FAILED",
        message: error instanceof Error ? error.message : "Falha ao abrir portal.",
      });
    }
  }
}
