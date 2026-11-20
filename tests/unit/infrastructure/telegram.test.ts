import { describe, it, expect, vi, afterEach } from "vitest";
import { parseTelegramUpdate } from "@/infrastructure/adapters/telegram/webhook-events";
import { TelegramAdapter } from "@/infrastructure/adapters/telegram/adapter";
import { createMessagingChannel } from "@/infrastructure/adapters/messaging-channel-factory";
import { ChatwootAdapter } from "@/infrastructure/adapters/chatwoot/adapter";
import { WhatsAppCloudAdapter } from "@/infrastructure/adapters/whatsapp-cloud/adapter";

const SECRET = "tg-secret-token";

function update(overrides: Record<string, unknown> = {}) {
  return {
    update_id: 1,
    message: {
      message_id: 77,
      date: 1700000000,
      from: { id: 555, first_name: "João", last_name: "Silva", username: "joaos" },
      chat: { id: 555, type: "private" },
      text: "Quero agendar",
      ...overrides,
    },
  };
}

function request(body: unknown, secret: string | null = SECRET) {
  return new Request("https://app.test/api/webhooks/channel/x", {
    method: "POST",
    body: JSON.stringify(body),
    headers: secret ? { "x-telegram-bot-api-secret-token": secret } : {},
  });
}

describe("parseTelegramUpdate", () => {
  it("maps a private text message", () => {
    const [msg] = parseTelegramUpdate(update());
    expect(msg).toMatchObject({
      channel: "telegram",
      externalMessageId: "555:77",
      externalConversationId: "555",
      senderExternalId: "555",
      senderName: "João Silva",
      senderPhone: null,
      content: "Quero agendar",
    });
  });

  it("ignores groups, bots and updates without a message", () => {
    expect(parseTelegramUpdate(update({ chat: { id: -1, type: "group" } }))).toEqual([]);
    expect(parseTelegramUpdate(update({ from: { id: 9, is_bot: true } }))).toEqual([]);
    expect(parseTelegramUpdate({ update_id: 2 })).toEqual([]);
  });

  it("labels media with caption", () => {
    const [msg] = parseTelegramUpdate(update({ text: undefined, photo: [{}], caption: "comprovante" }));
    expect(msg.content).toBe("[imagem] comprovante");
  });

  it("captures the phone only when the user shares their own contact", () => {
    const own = parseTelegramUpdate(update({ text: undefined, contact: { phone_number: "5511988887777", user_id: 555 } }));
    expect(own[0].senderPhone).toBe("+5511988887777");
    const other = parseTelegramUpdate(update({ text: undefined, contact: { phone_number: "5511911112222", user_id: 1 } }));
    expect(other[0].senderPhone).toBeNull();
  });
});

describe("TelegramAdapter", () => {
  const adapter = new TelegramAdapter();

  afterEach(() => vi.unstubAllGlobals());

  it("accepts the registered secret token", async () => {
    const result = await adapter.parseWebhook(request(update()), SECRET);
    expect(result.ok).toBe(true);
  });

  it("rejects a missing or wrong secret token", async () => {
    for (const secret of [null, "wrong", `${SECRET}x`]) {
      const result = await adapter.parseWebhook(request(update(), secret), SECRET);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("SECRET_INVALID");
    }
  });

  it("sends with sendMessage and returns the message id", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, result: { message_id: 901 } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await adapter.send({ target: { kind: "telegram", botToken: "123:abc", chatId: "555" }, content: "Olá!" });

    expect(result).toEqual({ ok: true, value: "901" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    expect(JSON.parse(init.body as string)).toEqual({ chat_id: "555", text: "Olá!" });
  });

  it("maps 429 to RATE_LIMITED", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, description: "Too Many Requests" }), { status: 429 }),
    ));
    const result = await adapter.send({ target: { kind: "telegram", botToken: "t", chatId: "1" }, content: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMITED");
  });
});

describe("createMessagingChannel", () => {
  it("returns the adapter for each channel kind", () => {
    expect(createMessagingChannel("chatwoot")).toBeInstanceOf(ChatwootAdapter);
    expect(createMessagingChannel("whatsapp_cloud")).toBeInstanceOf(WhatsAppCloudAdapter);
    expect(createMessagingChannel("telegram")).toBeInstanceOf(TelegramAdapter);
  });
});
