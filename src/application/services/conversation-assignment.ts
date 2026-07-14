import type { SupabaseClient } from "@supabase/supabase-js";

export interface AccountAgentSummary {
  id: string;
  name: string;
  email: string;
}

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Fetches assignable members (admin/agent roles) of an org from Supabase auth + membership.
 */
export async function fetchAccountAgents(params: {
  db: SupabaseClient;
  orgId: string;
}): Promise<AccountAgentSummary[]> {
  const { db, orgId } = params;

  const { data: members } = await db
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", orgId)
    .in("role", ["admin", "agent"]);

  if (!members?.length) return [];

  const userIds = members.map((m) => m.user_id);

  const { data: users } = await db
    .from("user_profiles")
    .select("id, email, name")
    .in("id", userIds);

  const list = (users ?? []) as Array<{ id: string; email: string | null; name: string | null }>;

  return list
    .filter((u): u is { id: string; email: string; name: string } => Boolean(u.email && u.name))
    .map((u) => ({ id: u.id, name: u.name.trim(), email: u.email.trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function resolveAgentByName(
  name: string,
  agents: AccountAgentSummary[],
):
  | { ok: true; agent: AccountAgentSummary }
  | { ok: false; error: string; available: string[] } {
  const query = normalizeLookup(name);
  const available = agents.map((a) => a.name).sort((a, b) => a.localeCompare(b));

  if (!query) {
    return { ok: false, error: "Nome do atendente não informado.", available };
  }

  const exact = agents.filter((a) => normalizeLookup(a.name) === query);
  if (exact.length === 1) return { ok: true, agent: exact[0] };
  if (exact.length > 1) {
    return {
      ok: false,
      error: `Nome ambíguo "${name}". Use o nome completo: ${exact.map((a) => `"${a.name}"`).join(", ")}.`,
      available,
    };
  }

  const partial = agents.filter((a) => normalizeLookup(a.name).includes(query));
  if (partial.length === 1) return { ok: true, agent: partial[0] };
  if (partial.length > 1) {
    return {
      ok: false,
      error: `Nome ambíguo "${name}". Especifique um destes: ${partial.map((a) => `"${a.name}"`).join(", ")}.`,
      available,
    };
  }

  const emailMatch = agents.filter((a) => {
    const email = normalizeLookup(a.email);
    return email === query || (email.split("@")[0] ?? "") === query;
  });
  if (emailMatch.length === 1) return { ok: true, agent: emailMatch[0] };

  return {
    ok: false,
    error:
      `Atendente "${name}" não encontrado. ` +
      `Use um destes nomes: ${available.length > 0 ? available.map((n) => `"${n}"`).join(", ") : "nenhum atendente cadastrado"}.`,
    available,
  };
}
