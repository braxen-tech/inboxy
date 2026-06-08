import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PostHogIdentify } from "@/components/posthog-identify";
import { getOrgBySlug } from "@/lib/get-org";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function DashboardLayout({ children, params }: LayoutProps) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);

  if (!org) notFound();

  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      {user && (
        <PostHogIdentify
          userId={user.id}
          email={user.email}
          orgId={org.id}
          orgSlug={orgSlug}
          orgName={org.name}
          plan={org.subscription_plan}
        />
      )}
      <DashboardShell
        orgSlug={orgSlug}
        orgName={org.name}
        chatwootActive={org.chatwoot_status === "active"}
      >
        {children}
      </DashboardShell>
    </>
  );
}
