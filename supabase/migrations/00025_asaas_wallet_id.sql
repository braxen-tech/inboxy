-- Store the Asaas subaccount wallet ID returned when we provision a subconta
-- via the platform's white-label API. Useful for reconciliation/splits later.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS asaas_wallet_id text;
