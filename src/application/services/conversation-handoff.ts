import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";
import { cancelPendingFollowups } from "@/application/services/cancel-pending-followups";

export interface HandoffToHumanParams {
  db: SupabaseClient;
  orgId: string;
  conversationId: string;
  /** Auth user id of the agent to assign (optional — else queue is unassigned). */
  assigneeUserId?: string;
  assigneeName?: string;
  logContext?: Record<string, string>;
}

/**
 * Marks the conversation as needing human intervention (status=open),
 * optionally assigning to an agent user. Records activity and cancels
 * pending bot follow-ups.
 */
export async function handoffConversationToHuman(
  params: HandoffToHumanParams,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { db, orgId, conversationId, assigneeUserId, assigneeName, logContext = {} } = params;

  const update: Record<string, unknown> = {
    status: "open",
    updated_at: new Date().toISOString(),
  };
  if (assigneeUserId) update.assigned_to = assigneeUserId;

  const { error } = await db
    .from("conversations")
    .update(update)
    .eq("id", conversationId)
    .eq("organization_id", orgId);

  if (error) {
    logger.error("Handoff: failed to update conversation status", {
      ...logContext,
      error: error.message,
    });
    return { ok: false, error: error.message };
  }

  await cancelPendingFollowups(db, conversationId, "human_handoff");

  await db.from("activities").insert({
    organization_id: orgId,
    entity_type: "conversation",
    entity_id: conversationId,
    user_id: assigneeUserId ?? null,
    type: assigneeUserId ? "assigned" : "status_changed",
    content: assigneeUserId ? `Atribuído a ${assigneeName ?? "atendente"}` : "Transferido para fila de atendimento",
    metadata: { trigger: logContext.trigger ?? "bot_handoff" },
  });

  logger.info("Conversation handed off to human", logContext);
  captureServerEvent("human_handoff", {
    orgId,
    conversationId,
    trigger: logContext.trigger,
    assignee_id: assigneeUserId,
    assignee_name: assigneeName,
  });

  return { ok: true };
}
