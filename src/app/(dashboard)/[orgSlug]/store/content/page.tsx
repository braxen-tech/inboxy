import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { StoreConteudoEditor } from "../conteudo-editor";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function StoreContentPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = getAdminClient();

  const [{ data: blocks }, { data: digitalProducts }, { data: courses }] = await Promise.all([
    db.from("store_blocks").select("*").eq("organization_id", org.id).order("position", { ascending: true }),
    db.from("digital_products").select("id, title, price_brl").eq("organization_id", org.id).eq("active", true).order("created_at", { ascending: false }),
    db.from("courses").select("id, title, price_brl").eq("organization_id", org.id).order("created_at", { ascending: false }),
  ]);

  return (
    <StoreConteudoEditor
      orgSlug={orgSlug}
      initialBlocks={blocks ?? []}
      digitalProducts={digitalProducts ?? []}
      courses={courses ?? []}
    />
  );
}
