import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { parseStoreTheme } from "@/lib/store-theme";
import { StoreThemeProvider } from "@/components/store/store-theme-provider";
import { StorePage } from "@/components/store/store-page";
import { StoreChatWidget } from "@/components/store/store-chat-widget";
import { StoreAnalytics } from "@/components/store/store-analytics";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getStoreData(slug: string) {
  const db = getAdminClient();

  const { data: org } = await db
    .from("organizations")
    .select(
      "id, slug, name, store_enabled, store_display_name, store_bio, store_photo_url, store_theme, store_chat_enabled, store_chat_trigger, store_chat_trigger_seconds, store_chat_greeting, store_chatwoot_website_token, chatwoot_api_url",
    )
    .eq("slug", slug)
    .eq("store_enabled", true)
    .maybeSingle();

  if (!org) return null;

  const { data: blocks } = await db
    .from("store_blocks")
    .select("id, type, title, description, image_url, cta_text, external_url, price_display, duration_minutes, link_icon")
    .eq("organization_id", org.id)
    .eq("visible", true)
    .order("position", { ascending: true });

  const { data: socialLinks } = await db
    .from("store_social_links")
    .select("platform, url")
    .eq("organization_id", org.id)
    .order("position", { ascending: true });

  return {
    org,
    blocks: blocks ?? [],
    socialLinks: socialLinks ?? [],
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStoreData(slug);

  if (!data) {
    return { title: "Loja não encontrada" };
  }

  const displayName = data.org.store_display_name || data.org.name;
  const description = data.org.store_bio || `Confira os produtos e serviços de ${displayName}`;

  return {
    title: `${displayName} | Inboxy`,
    description,
    openGraph: {
      title: displayName,
      description,
      type: "website",
      ...(data.org.store_photo_url ? { images: [data.org.store_photo_url] } : {}),
    },
    twitter: {
      card: "summary",
      title: displayName,
      description,
    },
  };
}

export default async function StorePublicPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getStoreData(slug);

  if (!data) notFound();

  const { org, blocks, socialLinks } = data;
  const theme = parseStoreTheme(org.store_theme);
  const displayName = org.store_display_name || org.name;

  const showChat =
    org.store_chat_enabled &&
    org.store_chatwoot_website_token &&
    org.chatwoot_api_url;

  return (
    <StoreThemeProvider theme={theme}>
      <StoreAnalytics orgId={org.id} orgSlug={org.slug} />

      <StorePage
        displayName={displayName}
        bio={org.store_bio}
        photoUrl={org.store_photo_url}
        coverImageUrl={theme.coverImageUrl}
        socialLinks={socialLinks}
        blocks={blocks}
        cardLayout={theme.cardLayout}
        orgId={org.id}
        orgSlug={org.slug}
      />

      {showChat && (
        <StoreChatWidget
          chatwootApiUrl={org.chatwoot_api_url}
          websiteToken={org.store_chatwoot_website_token}
          trigger={org.store_chat_trigger}
          triggerSeconds={org.store_chat_trigger_seconds}
          greeting={org.store_chat_greeting}
          orgId={org.id}
          orgSlug={org.slug}
        />
      )}
    </StoreThemeProvider>
  );
}
