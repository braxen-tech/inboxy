CREATE TABLE store_discounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code                  text NOT NULL,
  description           text,
  percent_off           integer,
  amount_off_brl        decimal(10,2),
  max_uses              integer,
  uses_count            integer NOT NULL DEFAULT 0,
  expires_at            timestamptz,
  active                boolean NOT NULL DEFAULT true,
  stripe_coupon_id      text,
  stripe_promo_code_id  text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX store_discounts_org_code_idx ON store_discounts (organization_id, lower(code));

CREATE TRIGGER set_updated_at_store_discounts
  BEFORE UPDATE ON store_discounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE POLICY org_owner_store_discounts ON store_discounts FOR ALL
  USING (organization_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()));

ALTER TABLE store_banners
  ADD COLUMN discount_id uuid REFERENCES store_discounts(id) ON DELETE SET NULL;
