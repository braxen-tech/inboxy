-- Persist Chatwoot channel metadata on conversations (from webhook conversation.channel)

ALTER TABLE public.conversations
  ADD COLUMN chatwoot_channel text,
  ADD COLUMN chatwoot_inbox_id int;

CREATE INDEX idx_conversations_org_channel
  ON public.conversations (organization_id, chatwoot_channel)
  WHERE chatwoot_channel IS NOT NULL;
