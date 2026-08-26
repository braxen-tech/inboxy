-- Remove Chatwoot integration, add Evolution API channel support
-- Chatwoot replaced by Evolution API (WhatsApp only, self-hosted)

-- ============================================================
-- 1. Remove Chatwoot columns from organizations
-- ============================================================
DROP INDEX IF EXISTS idx_orgs_chatwoot_account;

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS chatwoot_api_url,
  DROP COLUMN IF EXISTS chatwoot_api_token,
  DROP COLUMN IF EXISTS chatwoot_account_id,
  DROP COLUMN IF EXISTS chatwoot_webhook_secret,
  DROP COLUMN IF EXISTS chatwoot_status,
  DROP COLUMN IF EXISTS chatwoot_agent_bot_id,
  DROP COLUMN IF EXISTS chatwoot_agent_bot_webhook_secret,
  DROP COLUMN IF EXISTS chatwoot_agent_bot_access_token;

-- Add Evolution API instance name per org (single WhatsApp instance)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS evolution_instance_name text;

-- ============================================================
-- 2. Update conversations table: Chatwoot IDs → Evolution IDs
-- ============================================================
DROP INDEX IF EXISTS idx_conv_chatwoot;
DROP INDEX IF EXISTS idx_conversations_org_channel;

ALTER TABLE public.conversations
  DROP COLUMN IF EXISTS chatwoot_conversation_id,
  DROP COLUMN IF EXISTS chatwoot_channel,
  DROP COLUMN IF EXISTS chatwoot_inbox_id;

-- remote_jid: WhatsApp JID of the contact (e.g. 5521999999999@s.whatsapp.net)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS evolution_remote_jid text,
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp'));

CREATE INDEX IF NOT EXISTS idx_conversations_evolution_jid
  ON public.conversations (organization_id, evolution_remote_jid)
  WHERE evolution_remote_jid IS NOT NULL;

-- ============================================================
-- 3. Add evolution_contact_id to contacts
-- ============================================================
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS evolution_contact_id text;

-- ============================================================
-- 4. channel_configs table (one row per org per channel)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.channel_configs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel                 text NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp')),
  evolution_instance_name text NOT NULL,
  status                  text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'connecting', 'active', 'error', 'disconnected')),
  -- temporary connection data (QR code, pairing code) from Evolution API
  connection_data         jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, channel)
);

ALTER TABLE public.channel_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_owner_channel_configs" ON public.channel_configs
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE owner_user_id = auth.uid()
    )
  );

CREATE INDEX idx_channel_configs_org ON public.channel_configs (organization_id);
CREATE INDEX idx_channel_configs_instance ON public.channel_configs (evolution_instance_name);
