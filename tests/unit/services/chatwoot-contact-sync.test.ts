import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncChatwootContact } from "@/application/services/chatwoot-contact-sync";

describe("syncChatwootContact", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";

        if (url.includes("/accounts/1/contacts/10") && method === "PUT") {
          const body = JSON.parse(String(init?.body));
          expect(body.name).toBe("Alice");
          expect(body.email).toBe("alice@example.com");
          return new Response(null, { status: 204 });
        }
        if (url.includes("/accounts/1/labels") && method === "GET") {
          return new Response(
            JSON.stringify({ payload: [{ id: 1, title: "lead-qualificado" }] }),
            { status: 200 },
          );
        }
        if (url.includes("/contacts/10/labels") && method === "GET") {
          return new Response(JSON.stringify({ payload: ["vip"] }), { status: 200 });
        }
        if (url.includes("/contacts/10/labels") && method === "POST") {
          const body = JSON.parse(String(init?.body));
          expect(body.labels).toEqual(expect.arrayContaining(["vip", "lead-qualificado"]));
          return new Response(
            JSON.stringify({ payload: body.labels }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ error: "unexpected" }), { status: 404 });
      }),
    );
  });

  it("returns error when no fields provided", async () => {
    const result = await syncChatwootContact({
      apiUrl: "https://app.chatwoot.com",
      apiToken: "token",
      accountId: "1",
      conversationId: 42,
      contactId: 10,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Nenhum dado informado");
    }
  });

  it("merges contact labels on add", async () => {
    const result = await syncChatwootContact({
      apiUrl: "https://app.chatwoot.com",
      apiToken: "token",
      accountId: "1",
      conversationId: 42,
      contactId: 10,
      name: "Alice",
      email: "alice@example.com",
      contactLabels: ["lead-qualificado"],
      labelAction: "add",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).toContain("lead-qualificado");
    }
  });

  it("rejects notes exceeding max length", async () => {
    const result = await syncChatwootContact({
      apiUrl: "https://app.chatwoot.com",
      apiToken: "token",
      accountId: "1",
      conversationId: 42,
      contactId: 10,
      note: "x".repeat(2001),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("2000");
    }
  });
});
