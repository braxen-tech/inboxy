import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export interface ManageLeadLabelsParams {
  db: SupabaseClient;
  orgId: string;
  leadId: string;
  labels: string[];
  action: "add" | "remove";
  logContext?: Record<string, string>;
}

function normalize(label: string): string {
  return label.trim().toLowerCase();
}

async function fetchOrgTags(
  db: SupabaseClient,
  orgId: string,
): Promise<Array<{ id: string; name: string; color: string }>> {
  const { data } = await db
    .from("tags")
    .select("id, name, color")
    .eq("organization_id", orgId);
  return (data ?? []) as Array<{ id: string; name: string; color: string }>;
}

export async function manageLeadLabels(
  params: ManageLeadLabelsParams,
): Promise<{ ok: true; labels: string[] } | { ok: false; error: string }> {
  const { db, orgId, leadId, labels, action, logContext = {} } = params;

  if (labels.length === 0) {
    return { ok: false, error: "Nenhuma tag informada." };
  }

  const { data: lead } = await db
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!lead) {
    return { ok: false, error: "Lead não encontrado nesta organização." };
  }

  const tags = await fetchOrgTags(db, orgId);
  const byNormalized = new Map(tags.map((t) => [normalize(t.name), t]));
  const invalid: string[] = [];
  const resolved: Array<{ id: string; name: string }> = [];

  for (const req of labels) {
    const t = byNormalized.get(normalize(req));
    if (t) resolved.push(t);
    else invalid.push(req);
  }

  if (invalid.length > 0) {
    const available = tags.map((t) => t.name).sort().join(", ") || "nenhuma tag configurada";
    return {
      ok: false,
      error: `Tag(s) inválida(s): ${invalid.join(", ")}. Use apenas tags existentes: ${available}.`,
    };
  }

  if (action === "add") {
    const rows = resolved.map((t) => ({ lead_id: leadId, tag_id: t.id }));
    const { error } = await db.from("lead_tags").upsert(rows, { onConflict: "lead_id,tag_id" });
    if (error) {
      logger.warn("Failed to add lead tags", { ...logContext, error: error.message });
      return { ok: false, error: error.message };
    }
  } else {
    const ids = resolved.map((t) => t.id);
    const { error } = await db.from("lead_tags").delete().eq("lead_id", leadId).in("tag_id", ids);
    if (error) {
      logger.warn("Failed to remove lead tags", { ...logContext, error: error.message });
      return { ok: false, error: error.message };
    }
  }

  const { data: currentTags } = await db
    .from("lead_tags")
    .select("tags(name)")
    .eq("lead_id", leadId);

  const currentNames =
    ((currentTags as unknown as Array<{ tags: { name: string } | null }>) ?? [])
      .map((r) => r.tags?.name)
      .filter((n): n is string => Boolean(n));

  return { ok: true, labels: currentNames };
}
