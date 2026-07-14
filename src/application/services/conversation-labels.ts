import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";

export interface ManageConversationLabelsParams {
  db: SupabaseClient;
  orgId: string;
  conversationId: string;
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
): Promise<Array<{ id: string; name: string }>> {
  const { data } = await db.from("tags").select("id, name").eq("organization_id", orgId);
  return data ?? [];
}

export async function fetchAccountLabelTitles(params: {
  db: SupabaseClient;
  orgId: string;
}): Promise<string[]> {
  const tags = await fetchOrgTags(params.db, params.orgId);
  return tags.map((t) => t.name).sort((a, b) => a.localeCompare(b));
}

export async function manageConversationLabels(
  params: ManageConversationLabelsParams,
): Promise<{ ok: true; labels: string[] } | { ok: false; error: string }> {
  const { db, orgId, conversationId, labels, action, logContext = {} } = params;

  if (labels.length === 0) {
    return { ok: false, error: "Nenhuma tag informada." };
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
    const rows = resolved.map((t) => ({ conversation_id: conversationId, tag_id: t.id }));
    const { error } = await db.from("conversation_tags").upsert(rows, { onConflict: "conversation_id,tag_id" });
    if (error) {
      logger.warn("Failed to add conversation tags", { ...logContext, error: error.message });
      return { ok: false, error: error.message };
    }
  } else {
    const ids = resolved.map((t) => t.id);
    const { error } = await db
      .from("conversation_tags")
      .delete()
      .eq("conversation_id", conversationId)
      .in("tag_id", ids);
    if (error) {
      logger.warn("Failed to remove conversation tags", { ...logContext, error: error.message });
      return { ok: false, error: error.message };
    }
  }

  const { data: currentTags } = await db
    .from("conversation_tags")
    .select("tags(name)")
    .eq("conversation_id", conversationId);

  const currentNames =
    ((currentTags as unknown as Array<{ tags: { name: string } | null }>) ?? [])
      .map((r) => r.tags?.name)
      .filter((n): n is string => Boolean(n));

  captureServerEvent("conversation_label_applied", {
    ...logContext,
    action,
    labels: resolved.map((t) => t.name).join(", "),
  });

  return { ok: true, labels: currentNames };
}
