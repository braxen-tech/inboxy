/**
 * BillingProvider port — reserved for v1.3 (Stripe integration).
 * Not implemented in MVP. Defined here for architectural reference.
 */

import type { Result } from "../errors";
import type { OrgId } from "../value-objects";

export interface Subscription {
  id: string;
  plan: string;
  status: "active" | "past_due" | "canceled";
  messageQuota: number;
  currentPeriodEnd: Date;
}

export type BillingError = { code: "CHECKOUT_FAILED" | "SUBSCRIPTION_NOT_FOUND"; message: string };

export interface BillingProvider {
  createCheckoutSession(orgId: OrgId, plan: string): Promise<Result<string, BillingError>>;
  getSubscription(orgId: OrgId): Promise<Result<Subscription, BillingError>>;
}
