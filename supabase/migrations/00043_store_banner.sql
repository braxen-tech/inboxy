CREATE TABLE store_banners (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  text                text NOT NULL,
  link_url            text,
  link_product_id     uuid REFERENCES digital_products(id) ON DELETE SET NULL,
  link_course_id      uuid REFERENCES courses(id) ON DELETE SET NULL,
  link_label          text,
  visible_from        timestamptz,
  visible_until       timestamptz,
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX store_banners_org_idx ON store_banners (organization_id);

CREATE TRIGGER set_updated_at_store_banners
  BEFORE UPDATE ON store_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE POLICY org_owner_store_banners ON store_banners
  FOR ALL
  USING (organization_id IN (
    SELECT id FROM organizations WHERE owner_user_id = auth.uid()
  ));
