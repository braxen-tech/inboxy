import type { Result } from "../errors";
import type { OrgId } from "../value-objects";
import type { PlanId } from "@/lib/plans";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";

export interface Subscription {
  id: string;
  plan: PlanId;
  status: SubscriptionStatus;
  messageQuota: number;
  currentPeriodEnd: Date | null;
  /** Customer/payer ID on the payment gateway (Asaas, Stripe, PagarMe, etc). */
  paymentCustomerId: string | null;
}

export type BillingError = {
  code: "CHECKOUT_FAILED" | "SUBSCRIPTION_NOT_FOUND" | "PORTAL_FAILED" | "NOT_CONFIGURED";
  message: string;
};

/**
 * Platform billing gateway — charges orgs for their Inboxy subscription
 * (Starter/Professional/Business). Implemented today by AsaasBillingAdapter;
 * swappable for Stripe/PagarMe/Iugu/etc without touching call sites.
 */
export interface BillingProvider {
  createCheckoutSession(
    orgId: OrgId,
    plan: PlanId,
    customerEmail: string,
  ): Promise<Result<string, BillingError>>;
  getSubscription(orgId: OrgId): Promise<Result<Subscription, BillingError>>;
  createPortalSession(orgId: OrgId): Promise<Result<string, BillingError>>;
}
