-- Agent Bot (manual ID) + conversation status aligned with Chatwoot (pending/open/closed)

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS chatwoot_agent_bot_id text,
  ADD COLUMN IF NOT EXISTS chatwoot_agent_bot_webhook_secret text;

-- Drop old CHECK before rewriting status values (active/human → pending/open)
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_status_check;

UPDATE public.conversations SET status = 'pending' WHERE status = 'active';
UPDATE public.conversations SET status = 'open' WHERE status = 'human';

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_status_check
  CHECK (status IN ('pending', 'open', 'closed'));

ALTER TABLE public.conversations
  ALTER COLUMN status SET DEFAULT 'pending';
