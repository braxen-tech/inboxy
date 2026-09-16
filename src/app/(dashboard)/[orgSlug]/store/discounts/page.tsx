import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import DiscountsClient from "./discounts-client";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function DiscountsPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = getAdminClient();
  const { data: discounts } = await db
    .from("store_discounts")
    .select("id, code, description, percent_off, amount_off_brl, max_uses, uses_count, expires_at, active, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  return <DiscountsClient orgSlug={orgSlug} initialDiscounts={discounts ?? []} />;
}
