-- A "product" block on the storefront can optionally link to an existing
-- digital product (created in /products) instead of duplicating price/file
-- fields. Digital products remain the single source of truth for pricing,
-- file, and payment_type; the block just decides where it shows up.
ALTER TABLE public.store_blocks
  ADD COLUMN IF NOT EXISTS digital_product_id uuid REFERENCES public.digital_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_store_blocks_digital_product
  ON public.store_blocks (digital_product_id)
  WHERE digital_product_id IS NOT NULL;
