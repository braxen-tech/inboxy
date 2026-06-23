import { describe, it, expect, vi, beforeEach } from "vitest";
import { ManageConversationLabelsTool } from "@/infrastructure/tools/manage-conversation-labels";
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
      accountId: "1",
      conversationId: 42,
    },
    ...overrides,
  };
}

describe("ManageConversationLabelsTool", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (url.includes("/accounts/1/labels") && method === "GET") {
          return new Response(
            JSON.stringify({
              payload: [
                { id: 1, title: "interessado" },
                { id: 2, title: "quente" },
              ],
            }),
            { status: 200 },
          );
        }
        if (url.includes("/conversations/42/labels") && method === "GET") {
          return new Response(JSON.stringify({ payload: [] }), { status: 200 });
        }
        if (url.includes("/conversations/42/labels") && method === "POST") {
          const body = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({ payload: body.labels }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: "unexpected" }), { status: 404 });
      }),
    );
  });

  it("returns error when Chatwoot context is missing", async () => {
    const tool = new ManageConversationLabelsTool();
    const result = await tool.execute(makeCtx({ chatwoot: undefined }), {
      labels: ["quente"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("EXECUTION_FAILED");
  });

  it("adds labels to conversation", async () => {
    const tool = new ManageConversationLabelsTool();
    const result = await tool.execute(makeCtx(), {
      labels: ["quente"],
      action: "add",
      reason: "Cliente pediu proposta",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("Labels aplicadas");
      expect(result.value).toContain("quente");
    }
  });

  it("returns error for invalid label", async () => {
    const tool = new ManageConversationLabelsTool();
    const result = await tool.execute(makeCtx(), {
      labels: ["super-quente"],
      action: "add",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EXECUTION_FAILED");
      expect(result.error.message).toContain("super-quente");
    }
  });
});
