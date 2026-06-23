import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UpdateChatwootContactTool } from "@/infrastructure/tools/update-chatwoot-contact";
import type { ToolContext } from "@/domain/ports";
import type { OrgId } from "@/domain/value-objects";

function makeCtx(overrides?: Partial<ToolContext>): ToolContext {
  return {
    orgId: "org-1" as OrgId,
    contactPhone: "+5511999999999",
    conversationId: "conv-uuid-1",
    localContactId: "local-contact-1",
    chatwoot: {
      apiUrl: "https://app.chatwoot.com",
      apiToken: "admin-token",
      accountId: "1",
      conversationId: 42,
      contactId: 99,
    },
    ...overrides,
  };
}

function createMockDb(): SupabaseClient {
  const from = vi.fn((table: string) => {
    if (table === "contacts") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { metadata: {}, name: "Old Name" },
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: null, error: null })),
        })),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { from } as unknown as SupabaseClient;
}

describe("UpdateChatwootContactTool", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";

        if (url.includes("/accounts/1/contacts/99") && method === "PUT") {
          return new Response(null, { status: 204 });
        }
        if (url.includes("/accounts/1/labels") && method === "GET") {
          return new Response(
            JSON.stringify({
              payload: [
                { id: 1, title: "lead-qualificado" },
                { id: 2, title: "vip" },
              ],
            }),
            { status: 200 },
          );
        }
        if (url.includes("/contacts/99/labels") && method === "GET") {
          return new Response(JSON.stringify({ payload: [] }), { status: 200 });
        }
        if (url.includes("/contacts/99/labels") && method === "POST") {
          const body = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({ payload: body.labels }), { status: 200 });
        }
        if (url.includes("/conversations/42/messages") && method === "POST") {
          const body = JSON.parse(String(init?.body));
          expect(body.private).toBe(true);
          return new Response(JSON.stringify({ id: 1, content: body.content }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: "unexpected" }), { status: 404 });
      }),
    );
  });

  it("returns error when Chatwoot context is missing", async () => {
    const tool = new UpdateChatwootContactTool(createMockDb());
    const result = await tool.execute(makeCtx({ chatwoot: undefined }), {
      name: "Alice",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("EXECUTION_FAILED");
  });

  it("updates contact, tags and private note", async () => {
    const tool = new UpdateChatwootContactTool(createMockDb());
    const result = await tool.execute(makeCtx(), {
      name: "Alice Silva",
      email: "alice@example.com",
      contact_labels: ["lead-qualificado"],
      note: "Interessada no plano Pro. Retornar amanhã.",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("Contato atualizado no Chatwoot");
      expect(result.value).toContain("lead-qualificado");
      expect(result.value).toContain("nota privada");
    }
  });

  it("returns error for invalid contact label", async () => {
    const tool = new UpdateChatwootContactTool(createMockDb());
    const result = await tool.execute(makeCtx(), {
      contact_labels: ["tag-inexistente"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EXECUTION_FAILED");
      expect(result.error.message).toContain("tag-inexistente");
    }
  });

  it("resolves contact ID via conversation API when missing from context", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";

        if (url.includes("/conversations/42") && method === "GET" && !url.includes("/messages")) {
          return new Response(
            JSON.stringify({ id: 42, meta: { sender: { id: 77 } } }),
            { status: 200 },
          );
        }
        if (url.includes("/accounts/1/contacts/77") && method === "PUT") {
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({ error: "unexpected" }), { status: 404 });
      }),
    );

    const tool = new UpdateChatwootContactTool(createMockDb());
    const result = await tool.execute(
      makeCtx({ chatwoot: { ...makeCtx().chatwoot!, contactId: undefined } }),
      { name: "Bob" },
    );

    expect(result.ok).toBe(true);
  });
});
