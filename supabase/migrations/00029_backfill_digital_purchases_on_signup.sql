-- Backfill digital_product_purchases.end_user_id when someone who bought a
-- digital product before creating a portal account (buyer_email match) signs up.
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

    -- Backfill: link any digital product purchases made with this email before signup.
    UPDATE public.digital_product_purchases
    SET end_user_id = NEW.id
    WHERE buyer_email = NEW.email AND end_user_id IS NULL;

  ELSE
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
