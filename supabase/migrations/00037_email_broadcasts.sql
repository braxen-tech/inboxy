CREATE TABLE public.email_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body_html text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
  sent_at timestamptz,
  recipient_count int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_broadcasts_org ON public.email_broadcasts(organization_id);

ALTER TABLE public.email_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY broadcasts_org_owner ON public.email_broadcasts
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE owner_user_id = auth.uid()
    )
  );
