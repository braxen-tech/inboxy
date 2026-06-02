import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMonthlyUsage } from "@/application/services/monthly-usage";

function mockDb(rows: { messages_in: number; messages_out: number }[]) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(async () => ({ data: rows, error: null })),
        })),
      })),
    })),
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("getMonthlyUsage", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("sums messages across daily rows in current month", async () => {
    const db = mockDb([
      { messages_in: 2, messages_out: 10 },
      { messages_in: 1, messages_out: 5 },
    ]);
    const usage = await getMonthlyUsage(db, "org-1");
    expect(usage.messagesIn).toBe(3);
    expect(usage.messagesOut).toBe(15);
  });

  it("returns zeros when no rows", async () => {
    const db = mockDb([]);
    const usage = await getMonthlyUsage(db, "org-1");
    expect(usage.messagesOut).toBe(0);
  });
});
