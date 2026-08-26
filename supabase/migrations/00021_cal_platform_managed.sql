-- Cal.com: platform-managed (Managed Users API)
-- Orgs no longer provide their own Cal.com API key.
-- Platform provisions a Cal.com managed user for each org on signup.

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS cal_api_key,
  DROP COLUMN IF EXISTS cal_booking_url,
  DROP COLUMN IF EXISTS cal_status;

-- cal_event_type_id and cal_timezone kept (org still configures these)
-- Add managed user credentials (stored encrypted at app level)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS cal_managed_user_id   integer,       -- Cal.com managed user ID
  ADD COLUMN IF NOT EXISTS cal_access_token_enc  text,          -- OAuth access token for managed user
  ADD COLUMN IF NOT EXISTS cal_refresh_token_enc text;          -- OAuth refresh token for managed user
