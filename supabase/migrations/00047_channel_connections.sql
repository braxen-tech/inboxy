-- Native messaging channels (WhatsApp Cloud API, Telegram) alongside legacy Chatwoot.
-- Written to apply both on the live DB (where 00019 never ran) and on a DB rebuilt from
-- this repo (where 00019 dropped the chatwoot conversation columns and added a
-- whatsapp-only `conversations.channel` CHECK).

CREATE TABLE IF NOT EXISTS public.channel_connections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel          text NOT NULL CHECK (channel IN ('whatsapp_cloud', 'telegram')),
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'disconnected', 'error')),
  -- Per-channel settings. Secrets inside are encrypted at app level (AesSecretStore).
  config           jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Shared secret for webhook auth (Meta verify token / Telegram secret_token).
  webhook_secret   text NOT NULL
    DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_channel_connections_org
  ON public.channel_connections (organization_id);

-- Lookup for a future platform-level Meta webhook keyed by phone_number_id.
CREATE INDEX IF NOT EXISTS idx_channel_connections_wa_phone
  ON public.channel_connections ((config->>'phone_number_id'))
  WHERE channel = 'whatsapp_cloud';

DROP TRIGGER IF EXISTS set_updated_at_channel_connections ON public.channel_connections;
CREATE TRIGGER set_updated_at_channel_connections
  BEFORE UPDATE ON public.channel_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.channel_connections;
CREATE POLICY tenant_isolation ON public.channel_connections
  USING (organization_id = public.current_organization_id());

-- ------------------------------------------------------------
-- conversations: which channel/connection a thread belongs to
-- ------------------------------------------------------------
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS chatwoot_conversation_id bigint,
  ADD COLUMN IF NOT EXISTS chatwoot_channel text,
  ADD COLUMN IF NOT EXISTS chatwoot_inbox_id bigint,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS channel_connection_id uuid
    REFERENCES public.channel_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_contact_id text;

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_channel_check;
UPDATE public.conversations SET channel = 'chatwoot'
  WHERE channel IS NULL OR channel = 'whatsapp';
ALTER TABLE public.conversations ALTER COLUMN channel SET DEFAULT 'chatwoot';
ALTER TABLE public.conversations ALTER COLUMN channel SET NOT NULL;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_channel_check
  CHECK (channel IN ('chatwoot', 'whatsapp_cloud', 'telegram'));

CREATE INDEX IF NOT EXISTS idx_conversations_connection_contact
  ON public.conversations (organization_id, channel_connection_id, external_contact_id)
  WHERE channel_connection_id IS NOT NULL;

-- ------------------------------------------------------------
-- messages: who sent an outbound message
-- ------------------------------------------------------------
-- Derived for existing rows; human replies (Inbox) will set it explicitly.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sender_type text
    CHECK (sender_type IN ('contact', 'ai', 'human', 'system')),
  ADD COLUMN IF NOT EXISTS sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.messages
  SET sender_type = CASE WHEN direction = 'inbound' THEN 'contact' ELSE 'ai' END
  WHERE sender_type IS NULL;
