import { redirect } from "next/navigation";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function PortalIndexPage({ params }: Props) {
  const { orgSlug } = await params;
  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect(`/portal/${orgSlug}/library`);
  } else {
    redirect(`/portal/${orgSlug}/login`);
  }
}
