import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingProvider, BillingError, Subscription } from "@/domain/ports/billing-provider";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import type { OrgId } from "@/domain/value-objects";
import { PLANS, type PlanId } from "@/lib/plans";
import { getStripe } from "./client";
import { logger } from "@/lib/logger";

export class StripeBillingAdapter implements BillingProvider {
  constructor(private db: SupabaseClient) {}

  async createCheckoutSession(
    orgId: OrgId,
    plan: PlanId,
    customerEmail: string,
  ): Promise<Result<string, BillingError>> {
    const stripe = getStripe();

    const { data: org } = await this.db
      .from("organizations")
      .select("name, stripe_customer_id")
      .eq("id", orgId)
      .single();

    if (!org) {
      return Err({ code: "CHECKOUT_FAILED", message: "Organização não encontrada." });
    }

    const priceId = process.env[`STRIPE_PRICE_ID_${plan.toUpperCase()}`];
    if (!priceId) {
      return Err({
        code: "CHECKOUT_FAILED",
        message: `Stripe price ID not configured for plan: ${plan}`,
      });
    }

    try {
      let customerId = org.stripe_customer_id ?? undefined;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: customerEmail,
          name: org.name ?? undefined,
          metadata: { orgId },
        });
        customerId = customer.id;

        await this.db
          .from("organizations")
          .update({ stripe_customer_id: customerId })
          .eq("id", orgId);
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.inboxy.io";
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/billing?success=1`,
        cancel_url: `${appUrl}/billing?canceled=1`,
        metadata: { orgId, plan },
        subscription_data: { metadata: { orgId, plan } },
      });

      if (!session.url) {
        return Err({ code: "CHECKOUT_FAILED", message: "Stripe did not return a checkout URL." });
      }

      return Ok(session.url);
    } catch (error) {
      logger.error("Stripe billing checkout failed", { orgId, plan, error: String(error) });
      return Err({ code: "CHECKOUT_FAILED", message: "Falha ao criar checkout." });
    }
  }

  async getSubscription(orgId: OrgId): Promise<Result<Subscription, BillingError>> {
    const { data: org } = await this.db
      .from("organizations")
      .select(
        "stripe_subscription_id, stripe_customer_id, subscription_plan, subscription_status, message_quota, subscription_current_period_end",
      )
      .eq("id", orgId)
      .single();

    if (!org) {
      return Err({ code: "SUBSCRIPTION_NOT_FOUND", message: "Organização não encontrada." });
    }

    const plan = (org.subscription_plan ?? "starter") as PlanId;
    return Ok({
      id: org.stripe_subscription_id ?? "",
      plan,
      status: (org.subscription_status ?? "trialing") as Subscription["status"],
      messageQuota: org.message_quota ?? PLANS[plan].messageQuota,
      currentPeriodEnd: org.subscription_current_period_end
        ? new Date(org.subscription_current_period_end)
        : null,
      paymentCustomerId: org.stripe_customer_id,
    });
  }

  async createPortalSession(orgId: OrgId): Promise<Result<string, BillingError>> {
    const stripe = getStripe();

    const { data: org } = await this.db
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", orgId)
      .single();

    if (!org?.stripe_customer_id) {
      return Err({
        code: "NOT_CONFIGURED",
        message: "Nenhuma assinatura ativa encontrada.",
      });
    }

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.inboxy.io";
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: `${appUrl}/billing`,
      });

      return Ok(session.url);
    } catch (error) {
      logger.error("Stripe portal session failed", { orgId, error: String(error) });
      return Err({ code: "PORTAL_FAILED", message: "Falha ao criar sessão do portal." });
    }
  }
}
