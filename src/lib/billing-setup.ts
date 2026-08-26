/** Marker stored in organizations.asaas_subscription_id during free pilot. */
export const PILOT_SUBSCRIPTION_ID = "pilot";

export const PILOT_MESSAGE_QUOTA = 1_000_000;

const BILLING_ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function isPilotMode(): boolean {
  return process.env.INBOXY_PILOT_MODE === "true";
}

export function isPilotSubscription(subscriptionId: string | null | undefined): boolean {
  return subscriptionId === PILOT_SUBSCRIPTION_ID;
}

/** Org must have an active/trialing subscription (Asaas platform billing) before using the dashboard. */
export function needsBillingSetup(org: {
  subscription_status?: string | null;
}): boolean {
  return !BILLING_ACTIVE_STATUSES.has(org.subscription_status ?? "trialing");
}

export function pilotSubscriptionFields() {
  return {
    subscription_plan: "business" as const,
    subscription_status: "active" as const,
    asaas_subscription_id: PILOT_SUBSCRIPTION_ID,
    message_quota: PILOT_MESSAGE_QUOTA,
  };
}

export function canGrantPilotSubscription(subscriptionId: string | null | undefined): boolean {
  return subscriptionId == null || isPilotSubscription(subscriptionId);
}
