-- Agent Bot API token (for outgoing messages as AgentBot, not as human user)

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS chatwoot_agent_bot_access_token text;
