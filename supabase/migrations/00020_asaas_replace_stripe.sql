-- Replace Stripe with Asaas (platform-managed payments)
-- Asaas handles both platform billing (org plans) and B2C commerce (org's customers)

-- ============================================================
-- 1. Remove Stripe Connect columns from organizations
-- ============================================================
DROP INDEX IF EXISTS idx_orgs_stripe_customer;
DROP INDEX IF EXISTS idx_orgs_subscription;

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS stripe_secret_key,
  DROP COLUMN IF EXISTS stripe_webhook_secret,
  DROP COLUMN IF EXISTS stripe_status,
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS subscription_id;

-- ============================================================
-- 2. Add Asaas columns to organizations
-- ============================================================
-- Platform creates a subconta in Asaas for each org on signup
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS asaas_subconta_id       text,
  ADD COLUMN IF NOT EXISTS asaas_api_key_enc        text,  -- subconta API key, encrypted at app level
  ADD COLUMN IF NOT EXISTS asaas_customer_id        text,  -- org as a customer on the platform's Asaas account
  ADD COLUMN IF NOT EXISTS asaas_subscription_id    text,  -- platform billing subscription (org's plan)
  ADD COLUMN IF NOT EXISTS asaas_status             text NOT NULL DEFAULT 'pending'
    CHECK (asaas_status IN ('pending', 'active', 'error'));

CREATE INDEX IF NOT EXISTS idx_orgs_asaas_subconta   ON public.organizations (asaas_subconta_id);
CREATE INDEX IF NOT EXISTS idx_orgs_asaas_customer   ON public.organizations (asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_orgs_asaas_sub        ON public.organizations (asaas_subscription_id);

-- ============================================================
-- 3. Update orders table: Stripe → Asaas
-- ============================================================
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS stripe_checkout_session_id,
  DROP COLUMN IF EXISTS stripe_payment_intent_id;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS asaas_payment_id   text,
  ADD COLUMN IF NOT EXISTS asaas_payment_link text,  -- URL to redirect customer for payment
  ADD COLUMN IF NOT EXISTS payment_method     text;  -- 'PIX', 'BOLETO', 'CREDIT_CARD'

CREATE INDEX IF NOT EXISTS idx_orders_asaas_payment
  ON public.orders (asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;

-- ============================================================
-- 4. Update order_items: Stripe product IDs → generic
-- ============================================================
ALTER TABLE public.order_items
  RENAME COLUMN stripe_product_id TO product_id;

ALTER TABLE public.order_items
  RENAME COLUMN stripe_price_id TO price_id;
