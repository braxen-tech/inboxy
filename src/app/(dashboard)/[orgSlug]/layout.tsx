import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getOrgBySlug } from "@/lib/get-org";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function DashboardLayout({ children, params }: LayoutProps) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);

  if (!org) notFound();

  return (
    <DashboardShell
      orgSlug={orgSlug}
      orgName={org.name}
      chatwootActive={org.chatwoot_status === "active"}
    >
      {children}
    </DashboardShell>
  );
}
