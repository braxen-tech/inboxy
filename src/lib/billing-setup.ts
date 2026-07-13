/** Marker stored in organizations.subscription_id during free pilot. */
export const PILOT_SUBSCRIPTION_ID = "pilot";

export const PILOT_MESSAGE_QUOTA = 1_000_000;

export function isPilotMode(): boolean {
  return process.env.INBOXY_PILOT_MODE === "true";
}

export function isPilotSubscription(subscriptionId: string | null | undefined): boolean {
  return subscriptionId === PILOT_SUBSCRIPTION_ID;
}

function hasRealStripeSubscription(subscriptionId: string | null | undefined): boolean {
  return !!subscriptionId && subscriptionId.startsWith("sub_");
}

/** Org must complete Stripe Checkout (card on file) before using the dashboard. */
export function needsBillingSetup(org: {
  subscription_id?: string | null;
}): boolean {
  if (!org.subscription_id) return true;
  if (isPilotSubscription(org.subscription_id)) return !isPilotMode();
  if (hasRealStripeSubscription(org.subscription_id)) return false;
  return false;
}

export function getTrialPeriodDays(): number {
  const raw = process.env.STRIPE_TRIAL_DAYS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 14;
  if (!Number.isFinite(parsed) || parsed < 1) return 14;
  return Math.min(parsed, 90);
}

export function pilotSubscriptionFields() {
  return {
    subscription_plan: "business" as const,
    subscription_status: "active" as const,
    subscription_id: PILOT_SUBSCRIPTION_ID,
    message_quota: PILOT_MESSAGE_QUOTA,
  };
}

export function canGrantPilotSubscription(subscriptionId: string | null | undefined): boolean {
  if (hasRealStripeSubscription(subscriptionId)) return false;
  return subscriptionId == null || isPilotSubscription(subscriptionId);
}
