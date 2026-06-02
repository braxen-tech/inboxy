-- Platform subscription billing (Stripe Billing for Inboxy)

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'starter'
    CHECK (subscription_plan IN ('starter', 'professional', 'business')),
  ADD COLUMN IF NOT EXISTS subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS message_quota integer NOT NULL DEFAULT 500;

CREATE INDEX IF NOT EXISTS idx_orgs_stripe_customer ON public.organizations(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_orgs_subscription ON public.organizations(subscription_id);
