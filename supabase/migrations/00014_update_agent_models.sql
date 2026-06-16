-- Anthropic retired claude-sonnet-4-20250514 on 2026-06-15.

ALTER TABLE public.organizations
  ALTER COLUMN model SET DEFAULT 'claude-sonnet-4-6';

UPDATE public.organizations
SET model = 'claude-sonnet-4-6'
WHERE model IN ('claude-sonnet-4-20250514', 'claude-sonnet-4-0');

UPDATE public.organizations
SET model = 'claude-haiku-4-5-20251001'
WHERE model IN ('claude-haiku-3-5-20241022', 'claude-3-haiku-20240307');

UPDATE public.organizations
SET model = 'claude-opus-4-8'
WHERE model IN ('claude-opus-4-20250514', 'claude-opus-4-0');
