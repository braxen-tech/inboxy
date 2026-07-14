-- Telegram as a first-class messaging channel (+ widen type checks)

-- channels.type: allow telegram
ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS channels_type_check;
ALTER TABLE public.channels
  ADD CONSTRAINT channels_type_check
  CHECK (type IN ('whatsapp', 'instagram', 'telegram'));

ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS telegram_bot_id text;

ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS channels_telegram_required;
ALTER TABLE public.channels
  ADD CONSTRAINT channels_telegram_required
    CHECK (type <> 'telegram' OR telegram_bot_id IS NOT NULL OR status <> 'active');

CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_telegram_bot
  ON public.channels (telegram_bot_id)
  WHERE type = 'telegram' AND status = 'active';

-- conversations.channel_type
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_channel_type_check;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_channel_type_check
  CHECK (channel_type IS NULL OR channel_type IN ('whatsapp', 'instagram', 'telegram'));

-- contacts: stable Telegram identity
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS telegram_user_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_org_telegram
  ON public.contacts (organization_id, telegram_user_id)
  WHERE telegram_user_id IS NOT NULL;
