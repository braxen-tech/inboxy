import {
  ChatwootClient,
  type ChatwootAccountAgent,
} from "@/infrastructure/adapters/chatwoot/client";

export interface AccountAgentSummary {
  id: number;
  name: string;
  email: string;
}

const ASSIGNABLE_ROLES = new Set(["agent", "administrator"]);

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase();
}

function isAssignableAgent(agent: ChatwootAccountAgent): boolean {
  if (!agent.name?.trim() || !agent.email?.trim()) return false;
  if (!agent.role) return true;
  return ASSIGNABLE_ROLES.has(agent.role);
}

export function toAccountAgentSummary(agent: ChatwootAccountAgent): AccountAgentSummary {
  return {
    id: agent.id,
    name: agent.name.trim(),
    email: agent.email.trim(),
  };
}

export function resolveAgentByName(
  name: string,
  agents: AccountAgentSummary[],
):
  | { ok: true; agent: AccountAgentSummary }
  | { ok: false; error: string; available: string[] } {
  const query = normalizeLookup(name);
  if (!query) {
    return {
      ok: false,
      error: "Nome do atendente não informado.",
      available: agents.map((a) => a.name).sort((a, b) => a.localeCompare(b)),
    };
  }

  const available = agents.map((a) => a.name).sort((a, b) => a.localeCompare(b));

  const exactNameMatches = agents.filter((a) => normalizeLookup(a.name) === query);
  if (exactNameMatches.length === 1) {
    return { ok: true, agent: exactNameMatches[0] };
  }
  if (exactNameMatches.length > 1) {
    return {
      ok: false,
      error: `Nome ambíguo "${name}". Use o nome completo: ${exactNameMatches.map((a) => `"${a.name}"`).join(", ")}.`,
      available,
    };
  }

  const partialNameMatches = agents.filter((a) => normalizeLookup(a.name).includes(query));
  if (partialNameMatches.length === 1) {
    return { ok: true, agent: partialNameMatches[0] };
  }
  if (partialNameMatches.length > 1) {
    return {
      ok: false,
      error: `Nome ambíguo "${name}". Especifique um destes: ${partialNameMatches.map((a) => `"${a.name}"`).join(", ")}.`,
      available,
    };
  }

  const emailMatches = agents.filter((a) => {
    const email = normalizeLookup(a.email);
    const localPart = email.split("@")[0] ?? "";
    return email === query || localPart === query;
  });
  if (emailMatches.length === 1) {
    return { ok: true, agent: emailMatches[0] };
  }
  if (emailMatches.length > 1) {
    return {
      ok: false,
      error: `Identificador ambíguo "${name}". Use o nome completo do atendente.`,
      available,
    };
  }

  return {
    ok: false,
    error:
      `Atendente "${name}" não encontrado. ` +
      `Use um destes nomes: ${available.length > 0 ? available.map((n) => `"${n}"`).join(", ") : "nenhum atendente configurado na conta"}.`,
    available,
  };
}

export async function fetchAccountAgents(params: {
  apiUrl: string;
  apiToken: string;
  accountId: string;
}): Promise<AccountAgentSummary[]> {
  const client = new ChatwootClient(params.apiUrl, params.apiToken);
  const result = await client.listAccountAgents(params.accountId);
  if (!result.ok) return [];

  return result.data
    .filter(isAssignableAgent)
    .map(toAccountAgentSummary)
    .sort((a, b) => a.name.localeCompare(b.name));
}
