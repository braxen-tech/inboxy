/** Org must complete Stripe Checkout (card on file) before using the dashboard. */
export function needsBillingSetup(org: {
  subscription_id?: string | null;
}): boolean {
  return !org.subscription_id;
}

export function getTrialPeriodDays(): number {
  const raw = process.env.STRIPE_TRIAL_DAYS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 14;
  if (!Number.isFinite(parsed) || parsed < 1) return 14;
  return Math.min(parsed, 90);
}
