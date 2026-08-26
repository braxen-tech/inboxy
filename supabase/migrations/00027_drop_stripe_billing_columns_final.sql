-- Platform billing now runs entirely on Asaas (asaas_subscription_id, asaas_customer_id,
-- both added in 00020). Stripe is fully removed from the platform — 00026 restored these
-- columns as a stop-gap while Asaas platform billing was being built; that build is done.
DROP INDEX IF EXISTS idx_orgs_stripe_customer;
DROP INDEX IF EXISTS idx_orgs_subscription;

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS subscription_id;
