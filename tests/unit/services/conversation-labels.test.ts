import { describe, it, expect, vi, beforeEach } from "vitest";
import { manageConversationLabels } from "@/application/services/conversation-labels";

describe("manageConversationLabels", () => {
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
                { id: 3, title: "frio" },
              ],
            }),
            { status: 200 },
          );
        }
        if (url.includes("/conversations/42/labels") && method === "GET") {
          return new Response(JSON.stringify({ payload: ["interessado"] }), { status: 200 });
        }
        if (url.includes("/conversations/42/labels") && method === "POST") {
          const body = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({ payload: body.labels }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: "unexpected" }), { status: 404 });
      }),
    );
  });

  const baseParams = {
    apiUrl: "https://app.chatwoot.com",
    apiToken: "token",
    accountId: "1",
    conversationId: 42,
  };

  it("adds labels with merge", async () => {
    const result = await manageConversationLabels({
      ...baseParams,
      labels: ["quente"],
      action: "add",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.labels).toEqual(["interessado", "quente"]);
    }
  });

  it("removes labels", async () => {
    const result = await manageConversationLabels({
      ...baseParams,
      labels: ["interessado"],
      action: "remove",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.labels).toEqual([]);
    }
  });

  it("rejects unknown labels", async () => {
    const result = await manageConversationLabels({
      ...baseParams,
      labels: ["inexistente"],
      action: "add",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("inexistente");
      expect(result.error).toContain("interessado");
    }
  });

  it("matches labels case-insensitively", async () => {
    const result = await manageConversationLabels({
      ...baseParams,
      labels: ["Quente"],
      action: "add",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.labels).toEqual(["interessado", "quente"]);
    }
  });
});
