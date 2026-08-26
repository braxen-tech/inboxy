-- Per-org secret used to verify the "asaas-access-token" header on the org's
-- own webhook (POST /api/webhooks/asaas/[orgId]) — without this any request
-- could impersonate a payment confirmation for that org.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS asaas_webhook_token_enc text;
