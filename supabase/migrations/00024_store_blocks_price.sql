-- Add numeric price field to store_blocks for agent commerce (Asaas payments)
ALTER TABLE public.store_blocks
  ADD COLUMN IF NOT EXISTS price_brl decimal(10, 2),
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'one_time'
    CHECK (payment_type IN ('one_time', 'recurring')),
  ADD COLUMN IF NOT EXISTS billing_cycle text
    CHECK (billing_cycle IN ('monthly', 'yearly'));
