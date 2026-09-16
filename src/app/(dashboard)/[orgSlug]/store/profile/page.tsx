import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { StorePerfilEditor } from "../perfil-editor";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function StoreProfilePage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = getAdminClient();
  const { data: socialLinks } = await db
    .from("store_social_links")
    .select("*")
    .eq("organization_id", org.id)
    .order("position", { ascending: true });

  return (
    <StorePerfilEditor
      orgSlug={orgSlug}
      initialDisplayName={org.store_display_name ?? ""}
      initialBio={org.store_bio ?? ""}
      initialPhotoUrl={org.store_photo_url ?? ""}
      initialSocialLinks={socialLinks ?? []}
    />
  );
}
