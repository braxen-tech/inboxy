import { notFound } from "next/navigation";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { FinancesPageClient } from "./finances-page-client";

interface PageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function FinancesPage({ params }: PageProps) {
  const { orgSlug } = await params;

  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const db = getAdminClient();
  const { data: org } = await db
    .from("organizations")
    .select("id, stripe_account_id, stripe_account_status, stripe_charges_enabled, stripe_payouts_enabled, owner_user_id")
    .eq("slug", orgSlug)
    .single();

  if (!org || org.owner_user_id !== user.id) notFound();

  return (
    <FinancesPageClient
      orgSlug={orgSlug}
      stripeAccountId={org.stripe_account_id}
      stripeAccountStatus={org.stripe_account_status ?? "pending"}
      chargesEnabled={org.stripe_charges_enabled ?? false}
      payoutsEnabled={org.stripe_payouts_enabled ?? false}
    />
  );
}
