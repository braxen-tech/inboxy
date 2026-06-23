import { describe, it, expect, vi, beforeEach } from "vitest";
import { handoffConversationToHuman } from "@/application/services/conversation-handoff";

describe("handoffConversationToHuman", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (url.includes("/toggle_status") && method === "POST") {
          return new Response(
            JSON.stringify({
              payload: { success: true, current_status: "open", conversation_id: 42 },
            }),
            { status: 200 },
          );
        }
        if (url.includes("/assignments") && method === "POST") {
          return new Response(JSON.stringify({ id: 10 }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      }),
    );
  });

  it("unassigns when no assigneeId provided", async () => {
    const fetchMock = vi.mocked(fetch);
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const db = { from: vi.fn().mockReturnValue({ update }) } as unknown as import("@supabase/supabase-js").SupabaseClient;

    const result = await handoffConversationToHuman({
      db,
      orgId: "org-1",
      conversationId: "conv-1",
      chatwoot: {
        apiUrl: "https://app.chatwoot.com",
        adminToken: "admin-token",
        accountId: "1",
        conversationId: 42,
      },
    });

    expect(result.ok).toBe(true);
    const assignmentCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/assignments"),
    );
    const body = JSON.parse(String((assignmentCall?.[1] as RequestInit)?.body));
    expect(body.assignee_id).toBeNull();
  });

  it("assigns specific agent when assigneeId provided", async () => {
    const fetchMock = vi.mocked(fetch);
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const db = { from: vi.fn().mockReturnValue({ update }) } as unknown as import("@supabase/supabase-js").SupabaseClient;

    const result = await handoffConversationToHuman({
      db,
      orgId: "org-1",
      conversationId: "conv-1",
      assigneeId: 10,
      assigneeName: "Ana Silva",
      chatwoot: {
        apiUrl: "https://app.chatwoot.com",
        adminToken: "admin-token",
        accountId: "1",
        conversationId: 42,
      },
    });

    expect(result.ok).toBe(true);
    const assignmentCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/assignments"),
    );
    const body = JSON.parse(String((assignmentCall?.[1] as RequestInit)?.body));
    expect(body.assignee_id).toBe(10);
  });
});
