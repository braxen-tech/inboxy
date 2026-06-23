import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatwootClient } from "@/infrastructure/adapters/chatwoot/client";

describe("ChatwootClient agent assignment APIs", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (url.includes("/accounts/1/agents") && method === "GET") {
          return new Response(
            JSON.stringify({
              payload: [
                { id: 10, name: "Ana Silva", email: "ana@example.com", role: "agent" },
                { id: 11, name: "Carlos Mendes", email: "carlos@example.com", role: "agent" },
              ],
            }),
            { status: 200 },
          );
        }
        if (url.includes("/conversations/42/assignments") && method === "POST") {
          const body = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({ id: body.assignee_id }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: "unexpected" }), { status: 404 });
      }),
    );
  });

  it("listAccountAgents returns agent summaries", async () => {
    const client = new ChatwootClient("https://app.chatwoot.com", "token");
    const result = await client.listAccountAgents("1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe("Ana Silva");
    }
  });

  it("assignConversation posts assignee_id", async () => {
    const client = new ChatwootClient("https://app.chatwoot.com", "token");
    const result = await client.assignConversation("1", 42, 10);
    expect(result.ok).toBe(true);
  });

  it("unassignConversation posts null assignee_id", async () => {
    const fetchMock = vi.mocked(fetch);
    const client = new ChatwootClient("https://app.chatwoot.com", "token");
    await client.unassignConversation("1", 42);
    const assignmentCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/assignments"),
    );
    expect(assignmentCall).toBeDefined();
    const body = JSON.parse(String((assignmentCall?.[1] as RequestInit)?.body));
    expect(body.assignee_id).toBeNull();
  });
});
