import { describe, it, expect, vi, beforeEach } from "vitest";
import { handoffConversationToHuman } from "@/application/services/conversation-handoff";

function makeDb(updateError: null | { message: string } = null) {
  const eq2 = vi.fn().mockResolvedValue({ error: updateError });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const update = vi.fn().mockReturnValue({ eq: eq1 });
  const selectEq = vi.fn().mockResolvedValue({ data: [], error: null });
  const select = vi.fn().mockReturnValue({ eq: selectEq });
  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  const deleteIn = vi.fn().mockReturnValue({ eq: deleteEq });
  const deleteFrom = vi.fn().mockReturnValue({ in: deleteIn });
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "conversations") return { update };
    if (table === "scheduled_messages") return { select, delete: deleteFrom };
    return { update, select };
  });
  return { from } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("handoffConversationToHuman", () => {
  it("updates conversation status to open", async () => {
    const db = makeDb();
    const result = await handoffConversationToHuman({
      db,
      orgId: "org-1",
      conversationId: "conv-1",
    });

    expect(result.ok).toBe(true);
    const { update } = (db.from as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "open" }));
  });

  it("returns error when DB update fails", async () => {
    const db = makeDb({ message: "constraint violation" });
    const result = await handoffConversationToHuman({
      db,
      orgId: "org-1",
      conversationId: "conv-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("constraint violation");
  });
});
