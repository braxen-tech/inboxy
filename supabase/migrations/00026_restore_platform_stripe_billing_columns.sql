-- Platform billing (org subscriptions R$97/297/697) still runs on Stripe today.
-- The Stripe->Asaas migration (00020) mistakenly dropped these columns, which are
-- only used for platform billing bookkeeping (not the B2C commerce Stripe
-- integration, which was correctly replaced by Asaas separately). Dropping them
-- broke login for every org (ensure-user-organization.ts selected subscription_id)
-- and the "change plan" checkout flow (billing-adapter.ts selected stripe_customer_id).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS subscription_id text;

CREATE INDEX IF NOT EXISTS idx_orgs_stripe_customer ON public.organizations (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_orgs_subscription ON public.organizations (subscription_id);
