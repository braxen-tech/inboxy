-- Fix channels upsert: connectChannel uses onConflict = "organization_id,type"
-- but only a non-unique index existed, causing:
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification"

-- One channel row per (org, type). Reconnect updates the same row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_org_type_unique
  ON public.channels (organization_id, type);
