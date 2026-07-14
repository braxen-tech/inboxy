import { getOrgBySlug } from "@/lib/get-org";
import { normalizeFollowupIdleMinutes } from "@/lib/followup-idle-options";
import { notFound } from "next/navigation";
import { AgentForm } from "./agent-form";
import { fetchAccountLabelTitles } from "@/application/services/conversation-labels";
import { fetchAccountAgents } from "@/application/services/conversation-assignment";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function AgentPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = await getServerClientFromCookies();

  const { count: activeChannelCount } = await db
    .from("channels")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("status", "active");
  const hasActiveChannel = (activeChannelCount ?? 0) > 0;

  const [tags, agents] = await Promise.all([
    fetchAccountLabelTitles({ db, orgId: org.id }),
    fetchAccountAgents({ db, orgId: org.id }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Agente</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure a personalidade e comportamento do agente de IA.
        </p>
      </div>
      <AgentForm
        orgId={org.id}
        orgSlug={orgSlug}
        initialPrompt={org.system_prompt ?? ""}
        initialFollowupEnabled={org.followup_enabled ?? false}
        initialFollowupIdleMinutes={normalizeFollowupIdleMinutes(org.followup_idle_minutes ?? 60)}
        hasActiveChannel={hasActiveChannel}
        availableTags={tags}
        availableAgents={agents.map((a) => ({ name: a.name, email: a.email }))}
      />
    </div>
  );
}
