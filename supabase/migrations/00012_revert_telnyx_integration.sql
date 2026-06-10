-- Revert Telnyx voice integration columns
ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS telnyx_api_key,
  DROP COLUMN IF EXISTS telnyx_status,
  DROP COLUMN IF EXISTS telnyx_assistant_id,
  DROP COLUMN IF EXISTS telnyx_phone_number,
  DROP COLUMN IF EXISTS telnyx_webhook_secret;
