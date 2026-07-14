-- ============================================================
-- CRM MVP: replace Chatwoot with direct Meta integration
-- + leads/kanban, tags, activities, notifications, RBAC, search
-- ============================================================

-- ============================================================
-- 1. Drop Chatwoot artifacts on organizations & conversations
-- ============================================================
DROP INDEX IF EXISTS idx_orgs_chatwoot_account;
DROP INDEX IF EXISTS idx_conv_chatwoot;
DROP INDEX IF EXISTS idx_conversations_org_channel;

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS chatwoot_api_url,
  DROP COLUMN IF EXISTS chatwoot_api_token,
  DROP COLUMN IF EXISTS chatwoot_account_id,
  DROP COLUMN IF EXISTS chatwoot_webhook_secret,
  DROP COLUMN IF EXISTS chatwoot_status,
  DROP COLUMN IF EXISTS chatwoot_agent_bot_id,
  DROP COLUMN IF EXISTS chatwoot_agent_bot_webhook_secret;

ALTER TABLE public.conversations
  DROP COLUMN IF EXISTS chatwoot_conversation_id,
  DROP COLUMN IF EXISTS chatwoot_channel,
  DROP COLUMN IF EXISTS chatwoot_inbox_id;

-- ============================================================
-- 2. Channels (per-org connected Meta channels)
-- ============================================================
CREATE TABLE public.channels (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type                text NOT NULL CHECK (type IN ('whatsapp', 'instagram')),
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'disconnected', 'error')),

  -- Common Meta credentials
  meta_business_id    text,
  access_token        text, -- encrypted at app level (system-user token, long-lived)
  webhook_verify_token text,

  -- WhatsApp-specific
  waba_id             text,
  phone_number_id     text,
  phone_number        text,
  display_name        text,

  -- Instagram-specific
  ig_user_id          text,
  ig_username         text,

  connected_at        timestamptz,
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT channels_whatsapp_required
    CHECK (type <> 'whatsapp' OR (phone_number_id IS NOT NULL AND waba_id IS NOT NULL) OR status <> 'active'),
  CONSTRAINT channels_instagram_required
    CHECK (type <> 'instagram' OR ig_user_id IS NOT NULL OR status <> 'active')
);

CREATE UNIQUE INDEX idx_channels_whatsapp_phone
  ON public.channels (phone_number_id)
  WHERE type = 'whatsapp' AND status = 'active';

CREATE UNIQUE INDEX idx_channels_instagram_user
  ON public.channels (ig_user_id)
  WHERE type = 'instagram' AND status = 'active';

CREATE INDEX idx_channels_org ON public.channels (organization_id, type);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.channels
  USING (organization_id = public.current_organization_id());

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 3. Extend contacts with CRM fields
-- ============================================================
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS email          text,
  ADD COLUMN IF NOT EXISTS notes          text,
  ADD COLUMN IF NOT EXISTS custom_fields  jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS avatar_url     text,
  ADD COLUMN IF NOT EXISTS ig_user_id     text,
  ADD COLUMN IF NOT EXISTS ig_username    text;

-- Full-text search on contacts (name, email, phone, notes)
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(profile_name, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(email, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(phone, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(notes, '')), 'C')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_contacts_search
  ON public.contacts USING gin (search_tsv);

-- Contacts may exist without a phone (e.g. IG-only) — drop NOT NULL, keep composite uniqueness
ALTER TABLE public.contacts ALTER COLUMN phone DROP NOT NULL;

-- ============================================================
-- 4. Conversations: channel-aware, assignable, lead-linked
-- ============================================================
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS channel_id            uuid REFERENCES public.channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel_type          text CHECK (channel_type IN ('whatsapp', 'instagram')),
  ADD COLUMN IF NOT EXISTS external_conversation_id text, -- IG thread id / wa phone
  ADD COLUMN IF NOT EXISTS assigned_to           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_id               uuid,
  ADD COLUMN IF NOT EXISTS unread_count          int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority              text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- Update status check to include modern CRM states
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_status_check;
UPDATE public.conversations SET status = 'open' WHERE status NOT IN ('open', 'pending', 'closed', 'snoozed', 'resolved');
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_status_check
  CHECK (status IN ('pending', 'open', 'snoozed', 'resolved', 'closed'));

CREATE INDEX IF NOT EXISTS idx_conversations_org_status
  ON public.conversations (organization_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned
  ON public.conversations (assigned_to, status)
  WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_channel
  ON public.conversations (channel_id);

-- Add attachments and message type to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'contact', 'template')),
  ADD COLUMN IF NOT EXISTS attachments  jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_internal_note boolean NOT NULL DEFAULT false;

-- ============================================================
-- 5. Pipelines & Kanban stages
-- ============================================================
CREATE TABLE public.pipelines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  is_default      boolean NOT NULL DEFAULT false,
  position        int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipelines_org ON public.pipelines (organization_id, position);
CREATE UNIQUE INDEX idx_pipelines_default
  ON public.pipelines (organization_id)
  WHERE is_default = true;

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.pipelines
  USING (organization_id = public.current_organization_id());

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.pipeline_stages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pipeline_id     uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name            text NOT NULL,
  position        int NOT NULL DEFAULT 0,
  color           text,
  is_won          boolean NOT NULL DEFAULT false,
  is_lost         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pipeline_stages_won_lost_exclusive CHECK (NOT (is_won AND is_lost))
);

CREATE INDEX idx_pipeline_stages_pipeline
  ON public.pipeline_stages (pipeline_id, position);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.pipeline_stages
  USING (organization_id = public.current_organization_id());

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 6. Leads (kanban entity)
-- ============================================================
CREATE TABLE public.leads (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id           uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  pipeline_id          uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  pipeline_stage_id    uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
  assigned_to          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  title                text NOT NULL,
  description          text,
  value                numeric(14, 2) NOT NULL DEFAULT 0,
  currency             text NOT NULL DEFAULT 'BRL',
  expected_close_date  date,
  status               text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'won', 'lost')),
  lost_reason          text,
  position             int NOT NULL DEFAULT 0, -- position within stage for ordering
  custom_fields        jsonb NOT NULL DEFAULT '{}'::jsonb,

  closed_at            timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  search_tsv tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(description, '')), 'C')
    ) STORED
);

CREATE INDEX idx_leads_org_pipeline
  ON public.leads (organization_id, pipeline_id, pipeline_stage_id, position);
CREATE INDEX idx_leads_contact ON public.leads (contact_id);
CREATE INDEX idx_leads_assigned ON public.leads (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_leads_status ON public.leads (organization_id, status);
CREATE INDEX idx_leads_search ON public.leads USING gin (search_tsv);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.leads
  USING (organization_id = public.current_organization_id());

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Wire up conversations.lead_id now that leads exists
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_lead_fk
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_lead
  ON public.conversations (lead_id) WHERE lead_id IS NOT NULL;

-- ============================================================
-- 7. Tags (polymorphic on leads & conversations)
-- ============================================================
CREATE TABLE public.tags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  color           text NOT NULL DEFAULT '#6366f1',
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, name)
);

CREATE INDEX idx_tags_org ON public.tags (organization_id);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.tags
  USING (organization_id = public.current_organization_id());

CREATE TABLE public.lead_tags (
  lead_id    uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (lead_id, tag_id)
);

ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.lead_tags
  USING (EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_id AND l.organization_id = public.current_organization_id()
  ));

CREATE TABLE public.conversation_tags (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tag_id          uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (conversation_id, tag_id)
);

ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.conversation_tags
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.organization_id = public.current_organization_id()
  ));

-- ============================================================
-- 8. Activities (polymorphic activity log)
-- ============================================================
CREATE TABLE public.activities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type     text NOT NULL CHECK (entity_type IN ('lead', 'contact', 'conversation')),
  entity_id       uuid NOT NULL,
  type            text NOT NULL, -- e.g. 'note', 'stage_changed', 'assigned', 'message_sent', 'created'
  content         text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_entity
  ON public.activities (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_activities_org
  ON public.activities (organization_id, created_at DESC);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.activities
  USING (organization_id = public.current_organization_id());

-- ============================================================
-- 9. Notifications (in-app + push queue)
-- ============================================================
CREATE TABLE public.notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('new_message', 'assigned', 'mention', 'lead_stage_changed', 'invite')),
  title           text NOT NULL,
  body            text,
  entity_type     text CHECK (entity_type IN ('lead', 'contact', 'conversation', 'organization')),
  entity_id       uuid,
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_own ON public.notifications
  USING (user_id = auth.uid());

-- Web push subscriptions
CREATE TABLE public.push_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint        text NOT NULL UNIQUE,
  p256dh          text NOT NULL,
  auth_secret     text NOT NULL,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_used_at    timestamptz
);

CREATE INDEX idx_push_subs_user ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_subs_own ON public.push_subscriptions
  USING (user_id = auth.uid());

-- ============================================================
-- 10. Organization Members & RBAC
-- ============================================================
CREATE TABLE public.organization_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'agent'
    CHECK (role IN ('admin', 'agent', 'viewer')),
  invited_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON public.organization_members (user_id);
CREATE INDEX idx_org_members_org ON public.organization_members (organization_id);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_members_visible ON public.organization_members
  USING (organization_id = public.current_organization_id());

-- Invitations
CREATE TABLE public.organization_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'agent'
    CHECK (role IN ('admin', 'agent', 'viewer')),
  token           text NOT NULL UNIQUE,
  invited_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at      timestamptz NOT NULL,
  accepted_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, email)
);

CREATE INDEX idx_org_invites_org ON public.organization_invites (organization_id);
CREATE INDEX idx_org_invites_email ON public.organization_invites (email) WHERE accepted_at IS NULL;

ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_invites_tenant ON public.organization_invites
  USING (organization_id = public.current_organization_id());

-- Backfill: owner becomes admin member of their org
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT id, owner_user_id, 'admin'
FROM public.organizations
WHERE owner_user_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ============================================================
-- 11. User profiles (mirrors auth.users for RLS-safe joins)
-- ============================================================
CREATE TABLE public.user_profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text,
  name         text,
  avatar_url   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Members of the same organization can see each other's profile summary
CREATE POLICY user_profiles_visible_to_org_members ON public.user_profiles
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members m1
      JOIN public.organization_members m2 ON m2.organization_id = m1.organization_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = user_profiles.id
    )
    OR id = auth.uid()
  );

-- Users can update their own profile
CREATE POLICY user_profiles_self_update ON public.user_profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Auto-create profile on signup via trigger on auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users
INSERT INTO public.user_profiles (id, email, name)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 12. Helper: check current user's role in org
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_user_role_in_org(p_org_id uuid)
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT role FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = auth.uid()
  LIMIT 1
$$;
