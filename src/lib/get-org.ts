import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";

export async function getOrgBySlug(slug: string) {
  const db = getAdminClient();
  const { data } = await db
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .single();
  return data;
}
