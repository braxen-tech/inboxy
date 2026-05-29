-- Pivot: WhatsApp Cloud API -> Chatwoot
-- Adds Chatwoot integration columns, renames whatsapp_message_id,
-- adds chatwoot_conversation_id, and drops WhatsApp-specific columns.

-- ============================================================
-- 1. Add Chatwoot columns to organizations
-- ============================================================
ALTER TABLE public.organizations
  ADD COLUMN chatwoot_api_url TEXT,
  ADD COLUMN chatwoot_api_token TEXT,
  ADD COLUMN chatwoot_account_id TEXT,
  ADD COLUMN chatwoot_webhook_secret TEXT,
  ADD COLUMN chatwoot_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (chatwoot_status IN ('pending', 'active', 'disconnected'));

CREATE UNIQUE INDEX idx_orgs_chatwoot_account
  ON public.organizations (chatwoot_account_id)
  WHERE chatwoot_status = 'active';

-- ============================================================
-- 2. Rename whatsapp_message_id -> external_message_id
-- ============================================================
ALTER TABLE public.messages RENAME COLUMN whatsapp_message_id TO external_message_id;

-- ============================================================
-- 3. Add chatwoot_conversation_id to conversations
-- ============================================================
ALTER TABLE public.conversations ADD COLUMN chatwoot_conversation_id INT;
CREATE INDEX idx_conv_chatwoot ON public.conversations (chatwoot_conversation_id);

-- ============================================================
-- 4. Drop WhatsApp columns from organizations
-- ============================================================
DROP INDEX IF EXISTS idx_orgs_whatsapp_phone_id;

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS whatsapp_business_account_id,
  DROP COLUMN IF EXISTS whatsapp_phone_number_id,
  DROP COLUMN IF EXISTS whatsapp_phone_number,
  DROP COLUMN IF EXISTS whatsapp_access_token,
  DROP COLUMN IF EXISTS whatsapp_pin,
  DROP COLUMN IF EXISTS whatsapp_status;
