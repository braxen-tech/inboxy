-- Allow each authenticated user to read/update only their owned organization rows.
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_owner_select ON public.organizations;
CREATE POLICY organizations_owner_select
  ON public.organizations FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS organizations_owner_update ON public.organizations;
CREATE POLICY organizations_owner_update
  ON public.organizations FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
