import { describe, it, expect } from "vitest";
import { parseWebhookBody } from "@/infrastructure/adapters/whatsapp-cloud/webhook";

describe("Webhook body parsing", () => {
  it("extracts text messages correctly", () => {
    const payload = {
      raw: {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "123",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    phone_number_id: "phone_123",
                    display_phone_number: "+5511999990000",
                  },
                  contacts: [
                    { wa_id: "5511888880000", profile: { name: "Maria" } },
                  ],
                  messages: [
                    {
                      id: "wamid.abc123",
                      from: "5511888880000",
                      timestamp: "1700000000",
                      type: "text",
                      text: { body: "Olá, gostaria de agendar uma consulta" },
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      },
    };

    const messages = parseWebhookBody(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0].whatsappMessageId).toBe("wamid.abc123");
    expect(messages[0].from).toBe("5511888880000");
    expect(messages[0].profileName).toBe("Maria");
    expect(messages[0].content).toBe("Olá, gostaria de agendar uma consulta");
    expect(messages[0].phoneNumberId).toBe("phone_123");
  });

  it("ignores non-text messages", () => {
    const payload = {
      raw: {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "123",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: { phone_number_id: "phone_123", display_phone_number: "+55" },
                  contacts: [{ wa_id: "5511", profile: { name: "Teste" } }],
                  messages: [
                    { id: "img1", from: "5511", timestamp: "1700000000", type: "image" },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      },
    };

    const messages = parseWebhookBody(payload);
    expect(messages).toHaveLength(0);
  });

  it("ignores status updates", () => {
    const payload = {
      raw: {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "123",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: { phone_number_id: "phone_123", display_phone_number: "+55" },
                  statuses: [{ id: "wamid.xyz", status: "delivered" }],
                },
                field: "messages",
              },
            ],
          },
        ],
      },
    };

    const messages = parseWebhookBody(payload);
    expect(messages).toHaveLength(0);
  });
});
