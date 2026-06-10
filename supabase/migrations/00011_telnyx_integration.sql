-- Telnyx voice integration (BYOT API key + phone number per org)
ALTER TABLE public.organizations
  ADD COLUMN telnyx_api_key         text,
  ADD COLUMN telnyx_status          text NOT NULL DEFAULT 'pending'
    CHECK (telnyx_status IN ('pending', 'active', 'disconnected')),
  ADD COLUMN telnyx_assistant_id    text,
  ADD COLUMN telnyx_phone_number    text,
  ADD COLUMN telnyx_webhook_secret  text;
