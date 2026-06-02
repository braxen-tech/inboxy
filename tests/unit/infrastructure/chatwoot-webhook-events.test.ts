import { describe, it, expect } from "vitest";
import { parseChatwootWebhookPayload } from "@/infrastructure/adapters/chatwoot/webhook-events";

describe("parseChatwootWebhookPayload", () => {
  const baseMessage = {
    event: "message_created",
    id: 10,
    content: "Oi",
    message_type: "incoming",
    private: false,
    conversation: { id: 99, status: "pending" },
    account: { id: 1 },
    sender: { id: 1, name: "Ana", email: null, phone_number: "+5511999990000", type: "contact" },
  };

  it("parses message_created with conversation status", () => {
    const event = parseChatwootWebhookPayload(baseMessage);
    expect(event.type).toBe("message_created");
    if (event.type !== "message_created") return;
    expect(event.message.externalMessageId).toBe("10");
    expect(event.conversationStatus).toBe("pending");
  });

  it("parses conversation_updated", () => {
    const event = parseChatwootWebhookPayload({
      event: "conversation_updated",
      conversation: { id: 99, status: "open" },
    });
    expect(event.type).toBe("conversation_updated");
    if (event.type !== "conversation_updated") return;
    expect(event.chatwootConversationId).toBe(99);
    expect(event.status).toBe("open");
  });

  it("ignores outgoing messages", () => {
    const event = parseChatwootWebhookPayload({
      ...baseMessage,
      message_type: "outgoing",
    });
    expect(event.type).toBe("ignored");
  });

  it("accepts numeric incoming message_type from agent bot webhook", () => {
    const event = parseChatwootWebhookPayload({
      ...baseMessage,
      message_type: 0,
    });
    expect(event.type).toBe("message_created");
  });

  it("ignores agent_bot sender messages", () => {
    const event = parseChatwootWebhookPayload({
      ...baseMessage,
      sender: { ...baseMessage.sender, type: "agent_bot" },
    });
    expect(event.type).toBe("ignored");
  });
});
