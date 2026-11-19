-- Restore Chatwoot columns (removed in 00019, now needed again)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS chatwoot_api_url text,
  ADD COLUMN IF NOT EXISTS chatwoot_api_token text,
  ADD COLUMN IF NOT EXISTS chatwoot_account_id text,
  ADD COLUMN IF NOT EXISTS chatwoot_webhook_secret text,
  ADD COLUMN IF NOT EXISTS chatwoot_status text DEFAULT 'disconnected'
    CHECK (chatwoot_status IN ('active', 'disconnected', 'pending')),
  ADD COLUMN IF NOT EXISTS chatwoot_agent_bot_id text,
  ADD COLUMN IF NOT EXISTS chatwoot_agent_bot_webhook_secret text,
  ADD COLUMN IF NOT EXISTS chatwoot_agent_bot_access_token text;

CREATE INDEX IF NOT EXISTS idx_orgs_chatwoot_account
  ON public.organizations (chatwoot_account_id)
  WHERE chatwoot_account_id IS NOT NULL;
