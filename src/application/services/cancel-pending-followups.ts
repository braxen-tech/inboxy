import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export async function cancelPendingFollowups(
  db: SupabaseClient,
  conversationId: string,
  reason: string,
): Promise<void> {
  const { error } = await db
    .from("scheduled_followups")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversationId)
    .eq("status", "pending");

  if (error) {
    logger.warn("Failed to cancel pending follow-ups", {
      conversationId,
      reason,
      error: error.message,
    });
  }
}
