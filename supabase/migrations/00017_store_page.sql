-- Store page columns on organizations
ALTER TABLE public.organizations
  ADD COLUMN store_enabled              boolean NOT NULL DEFAULT false,
  ADD COLUMN store_display_name         text,
  ADD COLUMN store_bio                  text,
  ADD COLUMN store_photo_url            text,
  ADD COLUMN store_theme                jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN store_chat_enabled         boolean NOT NULL DEFAULT false,
  ADD COLUMN store_chat_trigger         text NOT NULL DEFAULT 'none'
    CHECK (store_chat_trigger IN ('none', 'timer', 'scroll', 'exit_intent')),
  ADD COLUMN store_chat_trigger_seconds integer NOT NULL DEFAULT 60,
  ADD COLUMN store_chat_greeting        text,
  ADD COLUMN store_chatwoot_website_token text;

-- Social links for the store page
CREATE TABLE public.store_social_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform        text NOT NULL
    CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'email', 'twitter', 'facebook', 'linkedin', 'website')),
  url             text NOT NULL,
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, platform)
);

CREATE INDEX idx_store_social_links_org ON public.store_social_links(organization_id, position);

-- Store page blocks (product, booking, link — extensible)
CREATE TABLE public.store_blocks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type            text NOT NULL
    CHECK (type IN ('product', 'booking', 'link')),
  position        integer NOT NULL DEFAULT 0,
  visible         boolean NOT NULL DEFAULT true,

  -- Common fields
  title           text,
  description     text,
  image_url       text,
  cta_text        text NOT NULL DEFAULT 'Comprar',
  external_url    text,

  -- Product fields
  price_display   text,

  -- Booking fields
  duration_minutes integer,

  -- Link fields
  link_icon       text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_store_blocks_org_position ON public.store_blocks(organization_id, position);

-- Auto-update updated_at
CREATE TRIGGER store_blocks_updated_at
  BEFORE UPDATE ON public.store_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.store_social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_owner_store_social_links" ON public.store_social_links
  FOR ALL USING (organization_id IN (
    SELECT id FROM public.organizations WHERE owner_user_id = auth.uid()
  ));

CREATE POLICY "org_owner_store_blocks" ON public.store_blocks
  FOR ALL USING (organization_id IN (
    SELECT id FROM public.organizations WHERE owner_user_id = auth.uid()
  ));
