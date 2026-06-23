import { describe, it, expect, vi, beforeEach } from "vitest";
import { TransferToHumanTool } from "@/infrastructure/tools/transfer-to-human";
import type { ToolContext } from "@/domain/ports";
import type { OrgId } from "@/domain/value-objects";

function makeCtx(overrides?: Partial<ToolContext>): ToolContext {
  return {
    orgId: "org-1" as OrgId,
    contactPhone: "+5511999999999",
    conversationId: "conv-uuid-1",
    chatwoot: {
      apiUrl: "https://app.chatwoot.com",
      apiToken: "admin-token",
      accountId: "165655",
      conversationId: 42,
    },
    ...overrides,
  };
}

describe("TransferToHumanTool", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/toggle_status") && init?.method === "POST") {
          return new Response(
            JSON.stringify({
              payload: { success: true, current_status: "open", conversation_id: 42 },
            }),
            { status: 200 },
          );
        }
        if (url.includes("/accounts/165655/agents") && init?.method === "GET") {
          return new Response(
            JSON.stringify({
              payload: [{ id: 10, name: "Ana Silva", email: "ana@example.com", role: "agent" }],
            }),
            { status: 200 },
          );
        }
        if (url.includes("/assignments") && init?.method === "POST") {
          return new Response("null", { status: 200 });
        }
        return new Response("{}", { status: 404 });
      }),
    );
  });

  it("returns error when Chatwoot context is missing", async () => {
    const db = {
      from: vi.fn(),
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    const tool = new TransferToHumanTool(db);
    const result = await tool.execute(makeCtx({ chatwoot: undefined }), {});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("EXECUTION_FAILED");
  });

  it("hands off conversation to open status", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const from = vi.fn().mockReturnValue({ update });
    const db = { from } as unknown as import("@supabase/supabase-js").SupabaseClient;

    const tool = new TransferToHumanTool(db);
    const result = await tool.execute(
      makeCtx(),
      { reason: "Cliente pediu atendente" },
    );

    expect(result.ok).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "open" }),
    );
    if (result.ok) {
      expect(result.value).toContain("Transferência concluída");
    }
  });

  it("assigns conversation to named agent", async () => {
    const fetchMock = vi.mocked(fetch);
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const from = vi.fn().mockReturnValue({ update });
    const db = { from } as unknown as import("@supabase/supabase-js").SupabaseClient;

    const tool = new TransferToHumanTool(db);
    const result = await tool.execute(makeCtx(), {
      reason: "Assunto financeiro",
      assignee_name: "Ana Silva",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("Ana Silva");
    }
    const assignmentCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/assignments"),
    );
    const body = JSON.parse(String((assignmentCall?.[1] as RequestInit)?.body));
    expect(body.assignee_id).toBe(10);
  });

  it("returns error for unknown assignee_name", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const from = vi.fn().mockReturnValue({ update });
    const db = { from } as unknown as import("@supabase/supabase-js").SupabaseClient;

    const tool = new TransferToHumanTool(db);
    const result = await tool.execute(makeCtx(), {
      assignee_name: "Inexistente",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Inexistente");
    }
  });
});
