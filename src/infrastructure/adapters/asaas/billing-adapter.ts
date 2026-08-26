import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingProvider, BillingError, Subscription } from "@/domain/ports/billing-provider";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import type { OrgId } from "@/domain/value-objects";
import { PLANS, type PlanId } from "@/lib/plans";
import { createPaymentLink, cancelSubscription, AsaasApiError } from "./client";
import { logger } from "@/lib/logger";

/** externalReference marker distinguishing platform billing payments from B2C order payments. */
export function platformCheckoutReference(orgId: string, plan: PlanId): string {
  return `platform:${orgId}:${plan}`;
}

export function parsePlatformCheckoutReference(
  externalReference: string | null | undefined,
): { orgId: string; plan: PlanId } | null {
  if (!externalReference?.startsWith("platform:")) return null;
  const [, orgId, plan] = externalReference.split(":");
  if (!orgId || !plan || !(plan in PLANS)) return null;
  return { orgId, plan: plan as PlanId };
}

function getPlatformApiKey(): string {
  const key = process.env.ASAAS_API_KEY?.trim();
  if (!key) throw new Error("ASAAS_API_KEY is not configured");
  return key;
}

/**
 * Platform billing via Asaas — charges orgs monthly for their Inboxy plan.
 * Uses the platform's own master Asaas account (not the org's subconta,
 * which is only for the org's own B2C commerce).
 */
export class AsaasBillingAdapter implements BillingProvider {
  constructor(private db: SupabaseClient) {}

  async createCheckoutSession(
    orgId: OrgId,
    plan: PlanId,
    _customerEmail: string,
  ): Promise<Result<string, BillingError>> {
    const { data: org } = await this.db
      .from("organizations")
      .select("name, asaas_subscription_id")
      .eq("id", orgId)
      .single();

    if (!org) {
      return Err({ code: "CHECKOUT_FAILED", message: "Organização não encontrada." });
    }

    const platformApiKey = getPlatformApiKey();

    // Cancel any existing platform subscription before starting a new one (plan change).
    if (org.asaas_subscription_id) {
      try {
        await cancelSubscription(platformApiKey, org.asaas_subscription_id);
      } catch (error) {
        logger.warn("Failed to cancel previous platform subscription", {
          orgId,
          subscriptionId: org.asaas_subscription_id,
          error: String(error),
        });
      }
    }

    try {
      const link = await createPaymentLink(platformApiKey, {
        name: `Assinatura Inboxy — ${PLANS[plan].name}`,
        description: `Plano ${PLANS[plan].name} (R$ ${PLANS[plan].price}/mês)`,
        billingType: "UNDEFINED",
        chargeType: "RECURRENT",
        subscriptionCycle: "MONTHLY",
        value: PLANS[plan].price,
        dueDateLimitDays: 5,
        externalReference: platformCheckoutReference(orgId, plan),
      });

      return Ok(link.url);
    } catch (error) {
      if (error instanceof AsaasApiError) {
        return Err({ code: "CHECKOUT_FAILED", message: `Erro ao gerar link de assinatura: ${JSON.stringify(error.body)}` });
      }
      logger.error("Platform billing checkout failed", { orgId, plan, error: String(error) });
      return Err({ code: "CHECKOUT_FAILED", message: "Falha ao criar checkout." });
    }
  }

  async getSubscription(orgId: OrgId): Promise<Result<Subscription, BillingError>> {
    const { data: org } = await this.db
      .from("organizations")
      .select("asaas_subscription_id, asaas_customer_id, subscription_plan, subscription_status, message_quota, subscription_current_period_end")
      .eq("id", orgId)
      .single();

    if (!org) {
      return Err({ code: "SUBSCRIPTION_NOT_FOUND", message: "Organização não encontrada." });
    }

    const plan = (org.subscription_plan ?? "starter") as PlanId;
    return Ok({
      id: org.asaas_subscription_id ?? "",
      plan,
      status: (org.subscription_status ?? "trialing") as Subscription["status"],
      messageQuota: org.message_quota ?? PLANS[plan].messageQuota,
      currentPeriodEnd: org.subscription_current_period_end
        ? new Date(org.subscription_current_period_end)
        : null,
      paymentCustomerId: org.asaas_customer_id,
    });
  }

  async createPortalSession(_orgId: OrgId): Promise<Result<string, BillingError>> {
    return Err({
      code: "NOT_CONFIGURED",
      message: "Asaas ainda não tem um portal de autoatendimento. Para trocar de plano, assine o novo plano abaixo.",
    });
  }
}
