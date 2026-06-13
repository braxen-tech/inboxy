import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";

export interface OwnedOrg {
  id: string;
  slug: string;
  owner_user_id: string;
  subscription_plan?: string | null;
}

export async function getOwnedOrg(orgSlug: string, userId: string): Promise<OwnedOrg | null> {
  const db = getAdminClient();
  const { data: org } = await db
    .from("organizations")
    .select("id, slug, owner_user_id, subscription_plan")
    .eq("slug", orgSlug)
    .single();

  if (!org || org.owner_user_id !== userId) return null;
  return org;
}
