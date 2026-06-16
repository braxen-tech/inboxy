import { getOrgBySlug } from "@/lib/get-org";
import { resolveAgentModel } from "@/lib/agent-models";
import { notFound } from "next/navigation";
import { AgentForm } from "./agent-form";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function AgentPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

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
        initialModel={resolveAgentModel(org.model)}
        chatwootActive={org.chatwoot_status === "active"}
      />
    </div>
  );
}
