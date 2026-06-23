-- Follow-up: silent nudge + scheduled manual follow-ups

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS followup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_idle_minutes int NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS followup_max_per_conversation int NOT NULL DEFAULT 1;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_followup_idle_minutes_check
  CHECK (followup_idle_minutes >= 30 AND followup_idle_minutes <= 720);

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_followup_max_per_conversation_check
  CHECK (followup_max_per_conversation >= 1 AND followup_max_per_conversation <= 5);

CREATE TABLE IF NOT EXISTS public.scheduled_followups (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id  uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  type             text NOT NULL CHECK (type IN ('silent_nudge', 'manual', 'sequence_step')),
  scheduled_at     timestamptz NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  message_content  text,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at          timestamptz,
  correlation_id   text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_followups_dispatch
  ON public.scheduled_followups (status, scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_followups_conversation
  ON public.scheduled_followups (conversation_id, type, status);

ALTER TABLE public.scheduled_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.scheduled_followups
  USING (organization_id = public.current_organization_id());
