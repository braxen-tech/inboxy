import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const LOCK_DURATION_MS = 60_000;

export async function acquireConversationLock(
  db: SupabaseClient,
  conversationId: string,
  correlationId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const lockUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();

  const { data, error } = await db
    .from("conversations")
    .update({ processing_lock_until: lockUntil })
    .eq("id", conversationId)
    .or(`processing_lock_until.is.null,processing_lock_until.lt.${now}`)
    .select("id")
    .single();

  if (error || !data) {
    logger.warn("Failed to acquire conversation lock", { conversationId, correlationId });
    return false;
  }
  return true;
}

export async function releaseConversationLock(
  db: SupabaseClient,
  conversationId: string,
): Promise<void> {
  await db
    .from("conversations")
    .update({ processing_lock_until: null })
    .eq("id", conversationId);
}
