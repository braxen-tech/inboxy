import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatwootAdapter } from "@/infrastructure/adapters/chatwoot/adapter";

const mockSendMessage = vi.fn();
const mockSendMessageWithAttachment = vi.fn();

vi.mock("@/infrastructure/adapters/chatwoot/client", () => {
  return {
    ChatwootClient: class {
      sendMessage = mockSendMessage;
      sendMessageWithAttachment = mockSendMessageWithAttachment;
    },
  };
});

describe("ChatwootAdapter.send with attachments", () => {
  const adapter = new ChatwootAdapter();

  const baseParams = {
    apiUrl: "https://chatwoot.example.com",
    apiToken: "token-123",
    accountId: "1",
    conversationId: 42,
    content: "Here is the product",
  };

  beforeEach(() => {
    mockSendMessage.mockReset();
    mockSendMessageWithAttachment.mockReset();
    mockSendMessage.mockResolvedValue({ ok: true, data: { id: 100 } });
    mockSendMessageWithAttachment.mockResolvedValue({ ok: true, data: { id: 101 } });
  });

  it("sends text only when no attachments", async () => {
    const result = await adapter.send(baseParams);

    expect(result.ok).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledWith("1", 42, "Here is the product", undefined);
    expect(mockSendMessageWithAttachment).not.toHaveBeenCalled();
  });

  it("sends attachments then text when both provided", async () => {
    const params = {
      ...baseParams,
      attachments: [
        { url: "https://img.stripe.com/a.jpg" },
        { url: "https://img.stripe.com/b.jpg", filename: "product-b.jpg" },
      ],
    };

    const result = await adapter.send(params);

    expect(result.ok).toBe(true);
    expect(mockSendMessageWithAttachment).toHaveBeenCalledTimes(2);
    expect(mockSendMessageWithAttachment).toHaveBeenCalledWith("1", 42, "", "https://img.stripe.com/a.jpg", undefined);
    expect(mockSendMessageWithAttachment).toHaveBeenCalledWith("1", 42, "", "https://img.stripe.com/b.jpg", "product-b.jpg");
    expect(mockSendMessage).toHaveBeenCalledWith("1", 42, "Here is the product", undefined);
  });

  it("sends only attachments when content is empty", async () => {
    const params = {
      ...baseParams,
      content: "",
      attachments: [{ url: "https://img.stripe.com/a.jpg" }],
    };

    const result = await adapter.send(params);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("attachments_sent");
    expect(mockSendMessageWithAttachment).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("returns rate limited error from attachment send", async () => {
    mockSendMessageWithAttachment.mockResolvedValue({ ok: false, status: 429, error: "Too many requests" });

    const params = {
      ...baseParams,
      attachments: [{ url: "https://img.stripe.com/a.jpg" }],
    };

    const result = await adapter.send(params);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMITED");
  });
});
