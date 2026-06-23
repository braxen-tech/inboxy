import { describe, it, expect, vi, beforeEach } from "vitest";
import { InngestEventBus } from "@/infrastructure/events/inngest-event-bus";

const mockSend = vi.fn();
const mockAssert = vi.fn();

vi.mock("@/infrastructure/events/inngest-client", () => ({
  inngest: { send: (...args: unknown[]) => mockSend(...args) },
  assertInngestEventKeyConfigured: () => mockAssert(),
}));

describe("InngestEventBus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue(undefined);
  });

  it("emits message.received with idempotency id", async () => {
    const bus = new InngestEventBus();
    await bus.emit({
      type: "message.received",
      payload: {
        orgId: "org-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        correlationId: "corr-1",
      },
    });

    expect(mockAssert).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith({
      name: "message.received",
      data: {
        orgId: "org-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        correlationId: "corr-1",
      },
      id: "message.received:msg-1",
    });
  });

  it("emits kb.document.uploaded with idempotency id", async () => {
    const bus = new InngestEventBus();
    await bus.emit({
      type: "kb.document.uploaded",
      payload: { orgId: "org-1", documentId: "doc-1" },
    });

    expect(mockAssert).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith({
      name: "kb.document.uploaded",
      data: { orgId: "org-1", documentId: "doc-1" },
      id: "kb.document.uploaded:doc-1",
    });
  });
});
