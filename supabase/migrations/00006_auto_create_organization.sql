-- Auto-provision organization when a new auth user is created.
-- Gives self-service signup without manual admin setup.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  org_slug text;
  org_name text;
BEGIN
  org_slug := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]+', '-', 'g'));
  org_slug := trim(both '-' from org_slug);

  IF org_slug = '' OR length(org_slug) < 2 THEN
    org_slug := 'org';
  END IF;

  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = org_slug) LOOP
    org_slug := org_slug || '-' || substring(gen_random_uuid()::text, 1, 4);
  END LOOP;

  org_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(NEW.email, '@', 1),
    'Minha organização'
  );

  INSERT INTO public.organizations (name, slug, owner_user_id)
  VALUES (org_name, org_slug, NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- One organization per owner (matches app logic in page.tsx).
CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_owner_user_id
  ON public.organizations (owner_user_id);
