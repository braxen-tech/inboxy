-- Stripe integration columns on organizations
ALTER TABLE public.organizations
  ADD COLUMN stripe_secret_key     text,
  ADD COLUMN stripe_webhook_secret text,
  ADD COLUMN stripe_status         text NOT NULL DEFAULT 'pending'
    CHECK (stripe_status IN ('pending', 'active', 'disconnected'));

-- Orders (cart -> checkout -> paid)
CREATE TABLE public.orders (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id             uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id                  uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status                      text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'checkout', 'paid', 'cancelled', 'expired')),
  stripe_checkout_session_id  text,
  stripe_payment_intent_id    text,
  checkout_url                text,
  total_amount                integer NOT NULL DEFAULT 0,
  currency                    text NOT NULL DEFAULT 'brl',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_org_id ON public.orders(organization_id);
CREATE INDEX idx_orders_conversation_id ON public.orders(conversation_id);
CREATE INDEX idx_orders_status ON public.orders(organization_id, status);
CREATE INDEX idx_orders_checkout_session ON public.orders(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;

-- Order line items
CREATE TABLE public.order_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stripe_product_id text NOT NULL,
  stripe_price_id   text NOT NULL,
  product_name      text NOT NULL,
  quantity          integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount       integer NOT NULL CHECK (unit_amount >= 0),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);

-- RLS policies (service role bypasses; match existing pattern)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_orders" ON public.orders
  FOR ALL USING (organization_id IN (
    SELECT id FROM public.organizations WHERE owner_user_id = auth.uid()
  ));

CREATE POLICY "org_members_order_items" ON public.order_items
  FOR ALL USING (order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.organizations org ON org.id = o.organization_id
    WHERE org.owner_user_id = auth.uid()
  ));
