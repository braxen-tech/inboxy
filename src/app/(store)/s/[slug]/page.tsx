import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { parseStoreTheme } from "@/lib/store-theme";
import { StoreThemeProvider } from "@/components/store/store-theme-provider";
import { StorePage } from "@/components/store/store-page";
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
      "id, slug, name, store_enabled, store_display_name, store_bio, store_photo_url, store_theme",
    )
    .eq("slug", slug)
    .eq("store_enabled", true)
    .maybeSingle();

  if (!org) return null;

  const { data: rawBlocks } = await db
    .from("store_blocks")
    .select(
      "id, type, title, description, image_url, cta_text, external_url, price_display, price_brl, payment_type, billing_cycle, duration_minutes, link_icon, digital_product_id, digital_products(id, title, description, thumbnail_url, price_brl, payment_type, billing_cycle, active)",
    )
    .eq("organization_id", org.id)
    .eq("visible", true)
    .order("position", { ascending: true });

  // A block linked to a digital product displays/sells that product — its own
  // price/title/description fields become a fallback the product overrides.
  const blocks = (rawBlocks ?? [])
    .map(({ digital_products, ...b }) => {
      const product = Array.isArray(digital_products) ? digital_products[0] : digital_products;
      if (b.digital_product_id && (!product || !product.active)) return null;

      return {
        id: b.id,
        type: b.type,
        title: product?.title ?? b.title,
        description: product?.description ?? b.description,
        image_url: product?.thumbnail_url ?? b.image_url,
        cta_text: b.cta_text,
        external_url: b.external_url,
        price_display:
          b.price_display ||
          (product?.price_brl != null
            ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.price_brl)
            : null),
        price_brl: product ? product.price_brl : b.price_brl,
        payment_type: product?.payment_type ?? b.payment_type,
        billing_cycle: product?.billing_cycle ?? b.billing_cycle,
        duration_minutes: b.duration_minutes,
        link_icon: b.link_icon,
        digital_product_id: b.digital_product_id,
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  const { data: socialLinks } = await db
    .from("store_social_links")
    .select("platform, url")
    .eq("organization_id", org.id)
    .order("position", { ascending: true });

  return {
    org,
    blocks,
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
    </StoreThemeProvider>
  );
}
