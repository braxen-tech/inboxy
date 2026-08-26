-- Unified users table with roles
-- Supports: org_owner (Inboxy client), end_user (client's customer who buys products/accesses portal)
-- Platform admins use service role directly; no row needed for them.

-- ============================================================
-- 1. Users table
-- ============================================================
CREATE TABLE public.users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'org_owner'
    CHECK (role IN ('org_owner', 'end_user')),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- for end_user: the org whose portal they belong to
  -- for org_owner: their own org (same as organizations.owner_user_id)
  contact_id      uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  -- optional link to a conversation contact (end_user who also messaged via WhatsApp)
  name            text,
  email           text,
  avatar_url      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_org    ON public.users (organization_id);
CREATE INDEX idx_users_role   ON public.users (role);
CREATE INDEX idx_users_email  ON public.users (email);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Org owners see themselves
CREATE POLICY "users_self" ON public.users
  FOR ALL USING (id = auth.uid());

-- Org owners see their end_users
CREATE POLICY "org_owner_sees_end_users" ON public.users
  FOR SELECT USING (
    role = 'end_user'
    AND organization_id IN (
      SELECT id FROM public.organizations WHERE owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- 2. Link purchases to end_user id
-- ============================================================
ALTER TABLE public.digital_product_purchases
  ADD COLUMN IF NOT EXISTS end_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_end_user
  ON public.digital_product_purchases (end_user_id)
  WHERE end_user_id IS NOT NULL;

-- ============================================================
-- 3. Update auth trigger: differentiate org_owner vs end_user signup
-- ============================================================
-- End users sign up via /portal/[orgSlug]/signup with metadata: {role: 'end_user', org_slug: '...'}
-- Org owners sign up via /signup (default path, no special metadata)

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role         text;
  v_org_id       uuid;
  v_org_slug     text;
  v_org_name     text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'org_owner');

  IF v_role = 'end_user' THEN
    -- End user: look up org by slug from metadata, insert into users only
    v_org_slug := NEW.raw_user_meta_data->>'org_slug';
    SELECT id INTO v_org_id FROM public.organizations WHERE slug = v_org_slug LIMIT 1;

    INSERT INTO public.users (id, role, organization_id, email, name)
    VALUES (
      NEW.id,
      'end_user',
      v_org_id,
      NEW.email,
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1))
    );

  ELSE
    -- Org owner: create organization (existing logic) then insert into users
    v_org_slug := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]+', '-', 'g'));
    v_org_slug := trim(both '-' from v_org_slug);

    IF v_org_slug = '' OR length(v_org_slug) < 2 THEN
      v_org_slug := 'org';
    END IF;

    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_org_slug) LOOP
      v_org_slug := v_org_slug || '-' || substring(gen_random_uuid()::text, 1, 4);
    END LOOP;

    v_org_name := COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(NEW.email, '@', 1),
      'Minha organização'
    );

    INSERT INTO public.organizations (name, slug, owner_user_id)
    VALUES (v_org_name, v_org_slug, NEW.id)
    RETURNING id INTO v_org_id;

    INSERT INTO public.users (id, role, organization_id, email, name)
    VALUES (
      NEW.id,
      'org_owner',
      v_org_id,
      NEW.email,
      v_org_name
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists from migration 00006; replace function is enough.
