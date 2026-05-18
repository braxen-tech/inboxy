import type { SupabaseClient } from "@supabase/supabase-js";

export async function incrementUsage(
  db: SupabaseClient,
  orgId: string,
  counters: {
    messagesIn?: number;
    messagesOut?: number;
    aiInputTokens?: number;
    aiOutputTokens?: number;
  },
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  await db.rpc("increment_usage_counters", {
    p_org_id: orgId,
    p_period: today,
    p_messages_in: counters.messagesIn ?? 0,
    p_messages_out: counters.messagesOut ?? 0,
    p_ai_input_tokens: counters.aiInputTokens ?? 0,
    p_ai_output_tokens: counters.aiOutputTokens ?? 0,
  });
}
