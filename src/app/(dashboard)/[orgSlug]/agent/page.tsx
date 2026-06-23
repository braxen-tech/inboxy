import { getOrgBySlug } from "@/lib/get-org";
import { resolveAgentModel } from "@/lib/agent-models";
import { notFound } from "next/navigation";
import { AgentForm } from "./agent-form";
import { fetchAccountLabelTitles } from "@/application/services/conversation-labels";
import { fetchAccountAgents } from "@/application/services/conversation-assignment";
import { AesSecretStore } from "@/infrastructure/crypto/aes-secret-store";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

async function loadChatwootLabels(org: {
  chatwoot_status?: string | null;
  chatwoot_api_url?: string | null;
  chatwoot_api_token?: string | null;
  chatwoot_account_id?: string | null;
}): Promise<string[]> {
  if (
    org.chatwoot_status !== "active" ||
    !org.chatwoot_api_url ||
    !org.chatwoot_api_token ||
    !org.chatwoot_account_id
  ) {
    return [];
  }

  const key = process.env.ENCRYPTION_KEY?.trim() ?? "";
  if (!key) return [];

  try {
    const apiToken = new AesSecretStore(key).decrypt(org.chatwoot_api_token);
    return await fetchAccountLabelTitles({
      apiUrl: org.chatwoot_api_url,
      apiToken,
      accountId: org.chatwoot_account_id,
    });
  } catch {
    return [];
  }
}

async function loadChatwootAgents(org: {
  chatwoot_status?: string | null;
  chatwoot_api_url?: string | null;
  chatwoot_api_token?: string | null;
  chatwoot_account_id?: string | null;
}) {
  if (
    org.chatwoot_status !== "active" ||
    !org.chatwoot_api_url ||
    !org.chatwoot_api_token ||
    !org.chatwoot_account_id
  ) {
    return [];
  }

  const key = process.env.ENCRYPTION_KEY?.trim() ?? "";
  if (!key) return [];

  try {
    const apiToken = new AesSecretStore(key).decrypt(org.chatwoot_api_token);
    return await fetchAccountAgents({
      apiUrl: org.chatwoot_api_url,
      apiToken,
      accountId: org.chatwoot_account_id,
    });
  } catch {
    return [];
  }
}

export default async function AgentPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const chatwootLabels =
    org.chatwoot_status === "active" ? await loadChatwootLabels(org) : [];
  const chatwootAgents =
    org.chatwoot_status === "active" ? await loadChatwootAgents(org) : [];

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
        chatwootLabels={chatwootLabels}
        chatwootAgents={chatwootAgents}
      />
    </div>
  );
}
