import { describe, it, expect, vi, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { parseWhatsAppCloudPayload, parseWhatsAppDeliveryFailures } from "@/infrastructure/adapters/whatsapp-cloud/webhook-events";
import { verifyMetaSignature } from "@/infrastructure/adapters/whatsapp-cloud/client";
import { WhatsAppCloudAdapter } from "@/infrastructure/adapters/whatsapp-cloud/adapter";

const APP_SECRET = "app-secret";

function textPayload(overrides: Record<string, unknown> = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "5511900000000", phone_number_id: "pn-1" },
              contacts: [{ wa_id: "5511999990000", profile: { name: "Maria" } }],
              messages: [
                {
                  from: "5511999990000",
                  id: "wamid.ABC",
                  timestamp: "1700000000",
                  type: "text",
                  text: { body: "Oi, vocês abrem sábado?" },
                  ...overrides,
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function signedRequest(body: string, secret = APP_SECRET) {
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  return new Request("https://app.test/api/webhooks/channel/x", {
    method: "POST",
    body,
    headers: { "x-hub-signature-256": `sha256=${sig}` },
  });
}

describe("parseWhatsAppCloudPayload", () => {
  it("maps a text message", () => {
    const [msg] = parseWhatsAppCloudPayload(textPayload());
    expect(msg).toMatchObject({
      channel: "whatsapp_cloud",
      externalMessageId: "wamid.ABC",
      externalConversationId: "5511999990000",
      senderName: "Maria",
      senderPhone: "+5511999990000",
      content: "Oi, vocês abrem sábado?",
      accountId: "pn-1",
    });
    expect(msg.timestamp.getTime()).toBe(1700000000 * 1000);
  });

  it("uses the reply title for interactive buttons", () => {
    const [msg] = parseWhatsAppCloudPayload(
      textPayload({ type: "interactive", text: undefined, interactive: { button_reply: { title: "Sim" } } }),
    );
    expect(msg.content).toBe("Sim");
  });

  it("labels media and keeps the caption", () => {
    const [msg] = parseWhatsAppCloudPayload(
      textPayload({ type: "image", text: undefined, image: { caption: "meu pedido" } }),
    );
    expect(msg.content).toBe("[imagem] meu pedido");
  });

  it("ignores status-only payloads and other objects", () => {
    const statusOnly = {
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: { statuses: [{ id: "x", status: "read" }] } }] }],
    };
    expect(parseWhatsAppCloudPayload(statusOnly)).toEqual([]);
    expect(parseWhatsAppCloudPayload({ object: "page" })).toEqual([]);
  });
});

describe("parseWhatsAppDeliveryFailures", () => {
  it("extracts failed statuses with Meta's error code", () => {
    const failures = parseWhatsAppDeliveryFailures({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: { statuses: [
        { id: "wamid.OK", status: "delivered", recipient_id: "1" },
        { id: "wamid.BAD", status: "failed", recipient_id: "5521", errors: [{ code: 131026, title: "Message undeliverable", error_data: { details: "x" } }] },
      ] } }] }],
    });
    expect(failures).toEqual([
      { messageId: "wamid.BAD", recipientId: "5521", code: 131026, title: "Message undeliverable", details: "x" },
    ]);
  });
});

describe("verifyMetaSignature", () => {
  const body = JSON.stringify(textPayload());
  const good = `sha256=${createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;

  it("accepts a valid signature", () => {
    expect(verifyMetaSignature(body, good, APP_SECRET)).toBe(true);
  });

  it("rejects tampered body, wrong secret, or missing header", () => {
    expect(verifyMetaSignature(`${body} `, good, APP_SECRET)).toBe(false);
    expect(verifyMetaSignature(body, good, "other")).toBe(false);
    expect(verifyMetaSignature(body, null, APP_SECRET)).toBe(false);
    expect(verifyMetaSignature(body, "sha256=abc", APP_SECRET)).toBe(false);
  });
});

describe("WhatsAppCloudAdapter", () => {
  const adapter = new WhatsAppCloudAdapter();

  afterEach(() => vi.unstubAllGlobals());

  it("parses a correctly signed webhook", async () => {
    const result = await adapter.parseWebhook(signedRequest(JSON.stringify(textPayload())), APP_SECRET);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(1);
  });

  it("rejects a webhook signed with another secret", async () => {
    const result = await adapter.parseWebhook(signedRequest(JSON.stringify(textPayload()), "x"), APP_SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("SECRET_INVALID");
  });

  it("sends a text message to the Graph API", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ messages: [{ id: "wamid.OUT" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await adapter.send({
      target: { kind: "whatsapp_cloud", phoneNumberId: "pn-1", accessToken: "tok", to: "5511999990000" },
      content: "Abrimos sim!",
    });

    expect(result).toEqual({ ok: true, value: "wamid.OUT" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/pn-1\/messages$/);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body as string)).toMatchObject({
      messaging_product: "whatsapp",
      to: "5511999990000",
      type: "text",
      text: { body: "Abrimos sim!" },
    });
  });

  it("maps an expired token to UNAUTHORIZED", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "expired", code: 190 } }), { status: 400 }),
    ));
    const result = await adapter.send({
      target: { kind: "whatsapp_cloud", phoneNumberId: "pn-1", accessToken: "tok", to: "1" },
      content: "x",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
  });

  it("refuses targets of another channel", async () => {
    const result = await adapter.send({ target: { kind: "telegram", botToken: "t", chatId: "1" }, content: "x" });
    expect(result.ok).toBe(false);
  });
});
