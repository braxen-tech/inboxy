-- Cal.com integration columns on organizations
ALTER TABLE public.organizations
  ADD COLUMN cal_api_key       text,
  ADD COLUMN cal_event_type_id text,
  ADD COLUMN cal_timezone      text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN cal_booking_url   text,
  ADD COLUMN cal_status        text NOT NULL DEFAULT 'pending'
    CHECK (cal_status IN ('pending', 'active', 'disconnected'));
