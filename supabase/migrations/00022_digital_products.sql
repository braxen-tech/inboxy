-- Digital products: files stored in Supabase Storage, purchased via Asaas

-- ============================================================
-- 1. Digital products table
-- ============================================================
CREATE TABLE public.digital_products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  thumbnail_url    text,
  file_path        text NOT NULL,         -- path in 'digital-products' Storage bucket
  file_name        text NOT NULL,         -- original filename shown to buyer
  file_size_bytes  bigint,
  content_type     text,                  -- e.g. 'application/pdf', 'application/zip'
  payment_type     text NOT NULL DEFAULT 'one_time'
    CHECK (payment_type IN ('one_time', 'recurring')),
  price_brl        decimal(10,2),
  billing_cycle    text
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  asaas_product_id text,                 -- product ID in org's Asaas subconta
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_digital_products_org ON public.digital_products (organization_id);

ALTER TABLE public.digital_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_owner_digital_products" ON public.digital_products
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- 2. Digital product purchases table
-- ============================================================
CREATE TABLE public.digital_product_purchases (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           uuid NOT NULL REFERENCES public.digital_products(id) ON DELETE CASCADE,
  -- buyer identity (end_user added in migration 00023)
  buyer_email          text NOT NULL,
  buyer_name           text,
  asaas_payment_id     text,
  asaas_subscription_id text,             -- for recurring products
  payment_type         text NOT NULL CHECK (payment_type IN ('one_time', 'recurring')),
  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'past_due', 'canceled', 'refunded')),
  purchased_at         timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz,        -- null = permanent; set for recurring (cancels on lapse)
  download_count       integer NOT NULL DEFAULT 0,
  last_downloaded_at   timestamptz
);

CREATE INDEX idx_purchases_product    ON public.digital_product_purchases (product_id);
CREATE INDEX idx_purchases_email      ON public.digital_product_purchases (buyer_email);
CREATE INDEX idx_purchases_asaas      ON public.digital_product_purchases (asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;

ALTER TABLE public.digital_product_purchases ENABLE ROW LEVEL SECURITY;

-- Org owners see purchases for their products
CREATE POLICY "org_owner_see_purchases" ON public.digital_product_purchases
  FOR SELECT USING (
    product_id IN (
      SELECT dp.id FROM public.digital_products dp
      JOIN public.organizations o ON o.id = dp.organization_id
      WHERE o.owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Storage bucket (run via Supabase dashboard or seed)
-- ============================================================
-- Bucket 'digital-products': private, org-scoped uploads
-- RLS: only service role reads (downloads served via signed URL from API route)
-- INSERT managed by org owner via service role
