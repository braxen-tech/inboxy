import { describe, it, expect, vi, beforeEach } from "vitest";
import { TransferToHumanTool } from "@/infrastructure/tools/transfer-to-human";
import type { ToolContext } from "@/domain/ports";
import type { OrgId } from "@/domain/value-objects";

function makeCtx(overrides?: Partial<ToolContext>): ToolContext {
  return {
    orgId: "org-1" as OrgId,
    contactPhone: "+5511999999999",
    conversationId: "conv-uuid-1",
    ...overrides,
  };
}

function makeDb(updateError: null | { message: string } = null) {
  const eq2 = vi.fn().mockResolvedValue({ error: updateError });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const update = vi.fn().mockReturnValue({ eq: eq1 });
  // cancelPendingFollowups also calls db.from
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

describe("TransferToHumanTool", () => {
  it("hands off conversation to open status", async () => {
    const db = makeDb();
    const tool = new TransferToHumanTool(db);
    const result = await tool.execute(makeCtx(), { reason: "Cliente pediu atendente" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("Transferência concluída");
    }
  });

  it("returns error when DB update fails", async () => {
    const db = makeDb({ message: "db error" });
    const tool = new TransferToHumanTool(db);
    const result = await tool.execute(makeCtx(), {});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("EXECUTION_FAILED");
  });

  it("executes without a reason", async () => {
    const db = makeDb();
    const tool = new TransferToHumanTool(db);
    const result = await tool.execute(makeCtx(), {});

    expect(result.ok).toBe(true);
  });
});
