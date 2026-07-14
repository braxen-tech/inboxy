-- CRM RLS fix: auth JWT does not carry org_id; grant access via org membership / ownership.

CREATE OR REPLACE FUNCTION public.user_has_org_access(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.organization_id = p_org_id
      AND m.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = p_org_id
      AND o.owner_user_id = auth.uid()
  );
$$;

-- Core tenant tables (00001)
DROP POLICY IF EXISTS tenant_isolation ON public.contacts;
CREATE POLICY tenant_isolation ON public.contacts
  FOR ALL TO authenticated
  USING (public.user_has_org_access(organization_id))
  WITH CHECK (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS tenant_isolation ON public.conversations;
CREATE POLICY tenant_isolation ON public.conversations
  FOR ALL TO authenticated
  USING (public.user_has_org_access(organization_id))
  WITH CHECK (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS tenant_isolation ON public.messages;
CREATE POLICY tenant_isolation ON public.messages
  FOR ALL TO authenticated
  USING (public.user_has_org_access(organization_id))
  WITH CHECK (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS tenant_isolation ON public.usage_counters;
CREATE POLICY tenant_isolation ON public.usage_counters
  FOR ALL TO authenticated
  USING (public.user_has_org_access(organization_id))
  WITH CHECK (public.user_has_org_access(organization_id));

-- Followups (00015)
DROP POLICY IF EXISTS tenant_isolation ON public.scheduled_followups;
CREATE POLICY tenant_isolation ON public.scheduled_followups
  FOR ALL TO authenticated
  USING (public.user_has_org_access(organization_id))
  WITH CHECK (public.user_has_org_access(organization_id));

-- CRM tables (00017)
DROP POLICY IF EXISTS tenant_isolation ON public.channels;
CREATE POLICY tenant_isolation ON public.channels
  FOR ALL TO authenticated
  USING (public.user_has_org_access(organization_id))
  WITH CHECK (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS tenant_isolation ON public.pipelines;
CREATE POLICY tenant_isolation ON public.pipelines
  FOR ALL TO authenticated
  USING (public.user_has_org_access(organization_id))
  WITH CHECK (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS tenant_isolation ON public.pipeline_stages;
CREATE POLICY tenant_isolation ON public.pipeline_stages
  FOR ALL TO authenticated
  USING (public.user_has_org_access(organization_id))
  WITH CHECK (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS tenant_isolation ON public.leads;
CREATE POLICY tenant_isolation ON public.leads
  FOR ALL TO authenticated
  USING (public.user_has_org_access(organization_id))
  WITH CHECK (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS tenant_isolation ON public.tags;
CREATE POLICY tenant_isolation ON public.tags
  FOR ALL TO authenticated
  USING (public.user_has_org_access(organization_id))
  WITH CHECK (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS tenant_isolation ON public.activities;
CREATE POLICY tenant_isolation ON public.activities
  FOR ALL TO authenticated
  USING (public.user_has_org_access(organization_id))
  WITH CHECK (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS tenant_isolation ON public.lead_tags;
CREATE POLICY tenant_isolation ON public.lead_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id AND public.user_has_org_access(l.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id AND public.user_has_org_access(l.organization_id)
    )
  );

DROP POLICY IF EXISTS tenant_isolation ON public.conversation_tags;
CREATE POLICY tenant_isolation ON public.conversation_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND public.user_has_org_access(c.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND public.user_has_org_access(c.organization_id)
    )
  );

DROP POLICY IF EXISTS org_members_visible ON public.organization_members;
CREATE POLICY org_members_visible ON public.organization_members
  FOR ALL TO authenticated
  USING (public.user_has_org_access(organization_id))
  WITH CHECK (public.user_has_org_access(organization_id));

DROP POLICY IF EXISTS org_invites_tenant ON public.organization_invites;
CREATE POLICY org_invites_tenant ON public.organization_invites
  FOR ALL TO authenticated
  USING (public.user_has_org_access(organization_id))
  WITH CHECK (public.user_has_org_access(organization_id));
