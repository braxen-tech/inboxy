import { describe, expect, it, vi } from "vitest";
import { TelegramBotAdapter } from "@/infrastructure/adapters/telegram-bot/adapter";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe("TelegramBotAdapter.parseWebhook", () => {
  const adapter = new TelegramBotAdapter();

  it("parses a private text message", async () => {
    const body = JSON.stringify({
      update_id: 1,
      message: {
        message_id: 42,
        date: 1_700_000_000,
        text: "Olá inboxy",
        chat: { id: 999, type: "private" },
        from: { id: 111, first_name: "Tiago", username: "tiago" },
      },
    });

    const result = await adapter.parseWebhook(body, null, "");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      channelType: "telegram",
      externalMessageId: "42",
      externalConversationId: "999",
      senderExternalId: "111",
      senderUsername: "tiago",
      content: "Olá inboxy",
    });
  });

  it("ignores group chats", async () => {
    const body = JSON.stringify({
      update_id: 2,
      message: {
        message_id: 1,
        text: "hi",
        chat: { id: 1, type: "group" },
        from: { id: 2, first_name: "A" },
      },
    });
    const result = await adapter.parseWebhook(body, null, "");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("IGNORED_EVENT");
  });

  it("ignores non-text messages", async () => {
    const body = JSON.stringify({
      update_id: 3,
      message: {
        message_id: 1,
        chat: { id: 1, type: "private" },
        from: { id: 2, first_name: "A" },
        photo: [{ file_id: "x" }],
      },
    });
    const result = await adapter.parseWebhook(body, null, "");
    expect(result.ok).toBe(false);
  });
});

describe("TelegramBotAdapter.send", () => {
  it("posts sendMessage and returns message id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true, result: { message_id: 77 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new TelegramBotAdapter();
    const result = await adapter.send({
      accessToken: "123:ABC",
      fromExternalId: "123",
      toExternalId: "999",
      content: "ping",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe("77");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bot123:ABC/sendMessage",
      expect.objectContaining({ method: "POST" }),
    );

    vi.unstubAllGlobals();
  });
});

describe("channel-registry", () => {
  it("returns telegram adapter", async () => {
    const { getChannelAdapter, getOutboundFromId } = await import(
      "@/infrastructure/adapters/channel-registry"
    );
    expect(getChannelAdapter("telegram").type).toBe("telegram");
    expect(
      getOutboundFromId({
        type: "telegram",
        telegram_bot_id: "99",
      }),
    ).toBe("99");
  });
});
