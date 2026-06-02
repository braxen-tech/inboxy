import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatwootClient, unwrapChatwootList } from "@/infrastructure/adapters/chatwoot/client";

describe("unwrapChatwootList", () => {
  it("unwraps payload array", () => {
    expect(unwrapChatwootList({ payload: [{ id: 1 }] })).toEqual([{ id: 1 }]);
  });
});

describe("ChatwootClient agent bot APIs", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (url.includes("/agent_bots") && method === "POST") {
          return new Response(JSON.stringify({ id: 99, name: "Test - Inboxy" }), { status: 200 });
        }
        if (url.includes("/inboxes") && method === "GET") {
          return new Response(JSON.stringify({ payload: [{ id: 10, name: "WhatsApp" }] }), {
            status: 200,
          });
        }
        if (url.includes("/set_agent_bot")) {
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({ error: "unexpected" }), { status: 404 });
      }),
    );
  });

  it("createAgentBot returns bot id", async () => {
    const client = new ChatwootClient("https://app.chatwoot.com", "token");
    const result = await client.createAgentBot("1", {
      name: "Org - Inboxy",
      outgoingUrl: "https://app.example.com/webhook",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(99);
  });

  it("listInboxes returns summaries", async () => {
    const client = new ChatwootClient("https://app.chatwoot.com", "token");
    const result = await client.listInboxes("1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([{ id: 10, name: "WhatsApp" }]);
    }
  });

  it("setInboxAgentBot succeeds on 204", async () => {
    const client = new ChatwootClient("https://app.chatwoot.com", "token");
    const result = await client.setInboxAgentBot("1", 10, 99);
    expect(result.ok).toBe(true);
  });

  it("sendMessage includes AgentBot sender when agentBotId set", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        expect(body.sender_type).toBe("AgentBot");
        expect(body.sender_id).toBe(99);
        return new Response(JSON.stringify({ id: 1 }), { status: 200 });
      }),
    );
    const client = new ChatwootClient("https://app.chatwoot.com", "bot-token");
    const result = await client.sendMessage("1", 42, "Olá", { agentBotId: 99 });
    expect(result.ok).toBe(true);
  });
});
