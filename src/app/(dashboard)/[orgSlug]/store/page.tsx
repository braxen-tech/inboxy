import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { parseStoreTheme } from "@/lib/store-theme";
import { StoreEditor } from "./store-editor";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function StoreEditorPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = getAdminClient();

  const { data: blocks } = await db
    .from("store_blocks")
    .select("*")
    .eq("organization_id", org.id)
    .order("position", { ascending: true });

  const { data: socialLinks } = await db
    .from("store_social_links")
    .select("*")
    .eq("organization_id", org.id)
    .order("position", { ascending: true });

  const { data: digitalProducts } = await db
    .from("digital_products")
    .select("id, title, price_brl")
    .eq("organization_id", org.id)
    .eq("active", true)
    .order("created_at", { ascending: false });

  const theme = parseStoreTheme(org.store_theme);

  return (
    <StoreEditor
      orgSlug={orgSlug}
      orgId={org.id}
      storeEnabled={org.store_enabled ?? false}
      displayName={org.store_display_name ?? ""}
      bio={org.store_bio ?? ""}
      photoUrl={org.store_photo_url ?? ""}
      socialLinks={socialLinks ?? []}
      blocks={blocks ?? []}
      digitalProducts={digitalProducts ?? []}
      theme={theme}
      chatEnabled={org.store_chat_enabled ?? false}
      chatTrigger={org.store_chat_trigger ?? "none"}
      chatTriggerSeconds={org.store_chat_trigger_seconds ?? 60}
      chatGreeting={org.store_chat_greeting ?? ""}
      subscriptionPlan={org.subscription_plan ?? "starter"}
    />
  );
}
