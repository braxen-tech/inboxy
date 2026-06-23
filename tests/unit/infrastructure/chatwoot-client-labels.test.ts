import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ChatwootClient,
  unwrapChatwootLabelTitles,
} from "@/infrastructure/adapters/chatwoot/client";

describe("unwrapChatwootLabelTitles", () => {
  it("unwraps string payload", () => {
    expect(unwrapChatwootLabelTitles({ payload: ["quente", "frio"] })).toEqual([
      "quente",
      "frio",
    ]);
  });

  it("unwraps label objects", () => {
    expect(
      unwrapChatwootLabelTitles({
        payload: [{ id: 1, title: "interessado" }, { id: 2, title: "quente" }],
      }),
    ).toEqual(["interessado", "quente"]);
  });
});

describe("ChatwootClient label APIs", () => {
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

  it("listAccountLabels returns label objects", async () => {
    const client = new ChatwootClient("https://app.chatwoot.com", "token");
    const result = await client.listAccountLabels("1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([
        { id: 1, title: "interessado" },
        { id: 2, title: "quente" },
      ]);
    }
  });

  it("getConversationLabels returns string titles", async () => {
    const client = new ChatwootClient("https://app.chatwoot.com", "token");
    const result = await client.getConversationLabels("1", 42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(["interessado"]);
  });

  it("setConversationLabels posts merged labels", async () => {
    const client = new ChatwootClient("https://app.chatwoot.com", "token");
    const result = await client.setConversationLabels("1", 42, ["interessado", "quente"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(["interessado", "quente"]);
  });
});
