import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ensureBotAccessToken,
  linkBotToAllInboxes,
  provisionChatwootAgentBot,
} from "@/application/services/chatwoot-agent-bot-provision";
import { ChatwootClient } from "@/infrastructure/adapters/chatwoot/client";

describe("chatwoot-agent-bot-provision", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (url.includes("/agent_bots") && method === "POST") {
          return new Response(
            JSON.stringify({ id: 5, name: "X - Inboxy", access_token: "bot-token-abc" }),
            { status: 200 },
          );
        }
        if (url.includes("/inboxes") && method === "GET") {
          return new Response(
            JSON.stringify({
              payload: [
                { id: 1, name: "A" },
                { id: 2, name: "B" },
              ],
            }),
            { status: 200 },
          );
        }
        if (url.includes("/inboxes/2/set_agent_bot")) {
          return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
        }
        if (url.includes("/set_agent_bot")) {
          return new Response(null, { status: 204 });
        }
        return new Response("{}", { status: 200 });
      }),
    );
  });

  it("provisionChatwootAgentBot links inboxes with partial failure", async () => {
    const client = new ChatwootClient("https://cw.test", "tok");
    const result = await provisionChatwootAgentBot(client, "1", "Clínica", "https://inboxy.test/hook");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.botId).toBe(5);
    expect(result.result.botAccessToken).toBe("bot-token-abc");
    expect(result.result.linkedInboxes).toHaveLength(1);
    expect(result.result.failedInboxes).toHaveLength(1);
    expect(result.result.failedInboxes[0].id).toBe(2);
  });

  it("ensureBotAccessToken calls reset when GET omits token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/reset_access_token")) {
          return new Response(JSON.stringify({ id: 5, access_token: "regenerated" }), {
            status: 200,
          });
        }
        if (url.includes("/agent_bots/5") && (init?.method ?? "GET") === "GET") {
          return new Response(JSON.stringify({ id: 5, name: "Bot" }), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      }),
    );
    const client = new ChatwootClient("https://cw.test", "tok");
    const token = await ensureBotAccessToken(client, "1", "5", {});
    expect(token).toBe("regenerated");
  });

  it("linkBotToAllInboxes reports per-inbox errors", async () => {
    const client = new ChatwootClient("https://cw.test", "tok");
    const { linkedInboxes, failedInboxes } = await linkBotToAllInboxes(client, "1", 5, [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
    expect(linkedInboxes).toHaveLength(1);
    expect(failedInboxes).toHaveLength(1);
  });

  it("cleanupOrphanInboxyAgentBots clears and deletes other Inboxy bots", async () => {
    const { cleanupOrphanInboxyAgentBots } = await import(
      "@/application/services/chatwoot-agent-bot-provision"
    );
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        calls.push(`${method} ${url}`);
        if (url.endsWith("/agent_bots") && method === "GET") {
          return new Response(
            JSON.stringify([
              {
                id: 5,
                name: "Keep",
                outgoing_url: "https://inboxy.test/api/webhooks/chatwoot/agent-bot?secret=a",
              },
              {
                id: 9,
                name: "Orphan",
                outgoing_url: "https://inboxy.test/api/webhooks/chatwoot/agent-bot?secret=b",
              },
            ]),
            { status: 200 },
          );
        }
        if (url.includes("/agent_bots/9") && method === "PATCH") {
          return new Response(JSON.stringify({ id: 9, outgoing_url: "" }), { status: 200 });
        }
        if (url.includes("/agent_bots/9") && method === "DELETE") {
          return new Response(null, { status: 200 });
        }
        return new Response("{}", { status: 200 });
      }),
    );

    const client = new ChatwootClient("https://cw.test", "tok");
    await cleanupOrphanInboxyAgentBots(client, "1", 5);
    expect(calls.some((c) => c.startsWith("PATCH ") && c.includes("/agent_bots/9"))).toBe(true);
    expect(calls.some((c) => c.startsWith("DELETE ") && c.includes("/agent_bots/9"))).toBe(true);
    expect(calls.some((c) => c.includes("/agent_bots/5") && c.startsWith("DELETE "))).toBe(false);
  });
});
