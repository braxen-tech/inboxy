import type { SupabaseClient } from "@supabase/supabase-js";

export interface MonthlyUsage {
  messagesIn: number;
  messagesOut: number;
}

function currentMonthStart(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export async function getMonthlyUsage(
  db: SupabaseClient,
  orgId: string,
): Promise<MonthlyUsage> {
  const { data, error } = await db
    .from("usage_counters")
    .select("messages_in, messages_out")
    .eq("organization_id", orgId)
    .gte("period_start", currentMonthStart());

  if (error || !data?.length) {
    return { messagesIn: 0, messagesOut: 0 };
  }

  return data.reduce(
    (acc, row) => ({
      messagesIn: acc.messagesIn + (row.messages_in ?? 0),
      messagesOut: acc.messagesOut + (row.messages_out ?? 0),
    }),
    { messagesIn: 0, messagesOut: 0 },
  );
}
