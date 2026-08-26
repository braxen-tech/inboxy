-- Allow orders created directly from the public storefront (no WhatsApp conversation).
ALTER TABLE public.orders
  ALTER COLUMN conversation_id DROP NOT NULL,
  ALTER COLUMN contact_id DROP NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'chat' CHECK (source IN ('chat', 'store'));
