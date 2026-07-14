import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PostHogIdentify } from "@/components/posthog-identify";
import { isPilotMode } from "@/lib/billing-setup";
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

  const { count: activeChannelCount } = await supabase
    .from("channels")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("status", "active");
  const hasActiveChannel = (activeChannelCount ?? 0) > 0;

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
        hasActiveChannel={hasActiveChannel}
        billingEnabled={!isPilotMode()}
        userId={user?.id ?? null}
        organizationId={org.id}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}
        supabaseAnonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""}
      >
        {children}
      </DashboardShell>
    </>
  );
}
