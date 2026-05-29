import { describe, it, expect } from "vitest";
import { ChatwootAdapter } from "@/infrastructure/adapters/chatwoot/adapter";

function makeRequest(body: Record<string, unknown>, secret = "test-secret"): Request {
  return new Request(`http://localhost/api/webhooks/chatwoot?secret=${secret}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  event: "message_created",
  id: 42,
  content: "Olá, gostaria de agendar uma consulta",
  content_type: "text",
  message_type: "incoming",
  created_at: "2025-06-01T10:30:00Z",
  private: false,
  sender: {
    id: 101,
    name: "Maria",
    email: "maria@example.com",
    phone_number: "+5511999990000",
    type: "contact",
  },
  conversation: {
    id: 5678,
    inbox_id: 1,
    status: "open",
  },
  account: {
    id: 1,
    name: "Minha Clinica",
  },
};

describe("ChatwootAdapter.parseWebhook", () => {
  const adapter = new ChatwootAdapter();
  const secret = "test-secret";

  it("extracts incoming contact message correctly", async () => {
    const request = makeRequest(validPayload, secret);
    const result = await adapter.parseWebhook(request, secret);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(1);
    const msg = result.value[0];
    expect(msg.externalMessageId).toBe("42");
    expect(msg.chatwootConversationId).toBe(5678);
    expect(msg.senderName).toBe("Maria");
    expect(msg.senderPhone).toBe("+5511999990000");
    expect(msg.senderEmail).toBe("maria@example.com");
    expect(msg.content).toBe("Olá, gostaria de agendar uma consulta");
    expect(msg.accountId).toBe("1");
  });

  it("rejects invalid secret", async () => {
    const request = makeRequest(validPayload, "wrong-secret");
    const result = await adapter.parseWebhook(request, secret);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("SECRET_INVALID");
  });

  it("ignores outgoing messages", async () => {
    const payload = { ...validPayload, message_type: "outgoing" };
    const request = makeRequest(payload, secret);
    const result = await adapter.parseWebhook(request, secret);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IGNORED_EVENT");
  });

  it("ignores agent (user) messages", async () => {
    const payload = {
      ...validPayload,
      sender: { ...validPayload.sender, type: "user" },
    };
    const request = makeRequest(payload, secret);
    const result = await adapter.parseWebhook(request, secret);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IGNORED_EVENT");
  });

  it("ignores private notes", async () => {
    const payload = { ...validPayload, private: true };
    const request = makeRequest(payload, secret);
    const result = await adapter.parseWebhook(request, secret);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IGNORED_EVENT");
  });

  it("ignores non-message_created events", async () => {
    const payload = { ...validPayload, event: "conversation_updated" };
    const request = makeRequest(payload, secret);
    const result = await adapter.parseWebhook(request, secret);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IGNORED_EVENT");
  });

  it("ignores empty content", async () => {
    const payload = { ...validPayload, content: "" };
    const request = makeRequest(payload, secret);
    const result = await adapter.parseWebhook(request, secret);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IGNORED_EVENT");
  });

  it("ignores null content", async () => {
    const payload = { ...validPayload, content: null };
    const request = makeRequest(payload, secret);
    const result = await adapter.parseWebhook(request, secret);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IGNORED_EVENT");
  });
});
