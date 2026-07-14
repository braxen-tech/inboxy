import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_STAGES = [
  { name: "Novo", position: 0, color: "#94a3b8" },
  { name: "Qualificado", position: 1, color: "#3b82f6" },
  { name: "Proposta", position: 2, color: "#8b5cf6" },
  { name: "Negociação", position: 3, color: "#f59e0b" },
  { name: "Fechamento", position: 4, color: "#10b981" },
];

/** Returns the id of the org's default pipeline, creating it (and default stages) on first access. */
export async function ensureDefaultPipeline(db: SupabaseClient, orgId: string): Promise<string> {
  const { data: existing } = await db
    .from("pipelines")
    .select("id")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data: created, error } = await db
    .from("pipelines")
    .insert({ organization_id: orgId, name: "Pipeline padrão", is_default: true })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Falha ao criar pipeline padrão.");

  const rows = DEFAULT_STAGES.map((s) => ({
    pipeline_id: created.id,
    name: s.name,
    position: s.position,
    color: s.color,
  }));

  await db.from("pipeline_stages").insert(rows);

  return created.id as string;
}
