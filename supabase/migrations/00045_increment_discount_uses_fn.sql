CREATE OR REPLACE FUNCTION public.increment_discount_uses(promo_code_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE store_discounts
  SET uses_count = uses_count + 1
  WHERE stripe_promo_code_id = promo_code_id;
END;
$$;
