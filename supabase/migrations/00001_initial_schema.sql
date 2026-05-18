-- MVP schema: multi-tenant WhatsApp agent
-- Tenancy isolated by organization_id + RLS

-- Helper: resolve current org from JWT custom claim
CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT (current_setting('request.jwt.claims', true)::json ->> 'org_id')::uuid
$$;

-- ============================================================
-- Organizations (tenant root — no RLS, accessed by admin/service role)
-- ============================================================
CREATE TABLE public.organizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  owner_user_id uuid NOT NULL,

  system_prompt  text NOT NULL DEFAULT '',
  knowledge_base text NOT NULL DEFAULT '',
  model          text NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  language       text NOT NULL DEFAULT 'pt-BR',
  tools_enabled  jsonb NOT NULL DEFAULT '[]'::jsonb,

  whatsapp_business_account_id text,
  whatsapp_phone_number_id     text,
  whatsapp_phone_number        text,
  whatsapp_access_token        text,   -- encrypted at app level
  whatsapp_pin                 text,   -- encrypted at app level
  whatsapp_status              text NOT NULL DEFAULT 'pending'
    CHECK (whatsapp_status IN ('pending', 'active', 'disconnected')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_orgs_whatsapp_phone_id
  ON public.organizations (whatsapp_phone_number_id)
  WHERE whatsapp_status = 'active';

-- ============================================================
-- Contacts
-- ============================================================
CREATE TABLE public.contacts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone            text NOT NULL,
  profile_name     text,
  name             text,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, phone)
);

CREATE INDEX idx_contacts_org ON public.contacts (organization_id);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.contacts
  USING (organization_id = public.current_organization_id());

-- ============================================================
-- Conversations
-- ============================================================
CREATE TABLE public.conversations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id            uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status                text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'human', 'closed')),
  last_message_at       timestamptz,
  last_inbound_at       timestamptz,
  processing_lock_until timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_org_last_msg
  ON public.conversations (organization_id, last_message_at DESC);
CREATE INDEX idx_conversations_contact
  ON public.conversations (contact_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.conversations
  USING (organization_id = public.current_organization_id());

-- ============================================================
-- Messages
-- ============================================================
CREATE TABLE public.messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id     uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction           text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content             text NOT NULL DEFAULT '',
  whatsapp_message_id text UNIQUE,
  status              text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processing', 'replied', 'failed')),
  ai_metadata         jsonb,
  correlation_id      text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation_created
  ON public.messages (conversation_id, created_at DESC);
CREATE INDEX idx_messages_org
  ON public.messages (organization_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.messages
  USING (organization_id = public.current_organization_id());

-- ============================================================
-- Processed webhook events (idempotency)
-- ============================================================
CREATE TABLE public.processed_webhook_events (
  event_id     text PRIMARY KEY,
  source       text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Webhook failures (DLQ)
-- ============================================================
CREATE TABLE public.webhook_failures (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload     jsonb NOT NULL,
  error       text NOT NULL,
  retry_count int NOT NULL DEFAULT 0,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Usage counters
-- ============================================================
CREATE TABLE public.usage_counters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start    date NOT NULL,
  messages_in     int NOT NULL DEFAULT 0,
  messages_out    int NOT NULL DEFAULT 0,
  ai_input_tokens  bigint NOT NULL DEFAULT 0,
  ai_output_tokens bigint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, period_start)
);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.usage_counters
  USING (organization_id = public.current_organization_id());

-- ============================================================
-- Audit log
-- ============================================================
CREATE TABLE public.audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id         uuid,
  action          text NOT NULL,
  details         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_org ON public.audit_log (organization_id, created_at DESC);

-- ============================================================
-- Updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- Upsert usage counters (called from app via rpc)
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_usage_counters(
  p_org_id uuid,
  p_period date,
  p_messages_in int DEFAULT 0,
  p_messages_out int DEFAULT 0,
  p_ai_input_tokens bigint DEFAULT 0,
  p_ai_output_tokens bigint DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.usage_counters (organization_id, period_start, messages_in, messages_out, ai_input_tokens, ai_output_tokens)
  VALUES (p_org_id, p_period, p_messages_in, p_messages_out, p_ai_input_tokens, p_ai_output_tokens)
  ON CONFLICT (organization_id, period_start)
  DO UPDATE SET
    messages_in = usage_counters.messages_in + EXCLUDED.messages_in,
    messages_out = usage_counters.messages_out + EXCLUDED.messages_out,
    ai_input_tokens = usage_counters.ai_input_tokens + EXCLUDED.ai_input_tokens,
    ai_output_tokens = usage_counters.ai_output_tokens + EXCLUDED.ai_output_tokens,
    updated_at = now();
END;
$$;
