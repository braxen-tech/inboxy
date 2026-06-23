import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventBus } from "@/domain/ports";
import { processChatwootInboundMessage } from "@/application/services/chatwoot-inbound";

vi.mock("@/application/services/usage-tracker", () => ({
  incrementUsage: vi.fn().mockResolvedValue(undefined),
}));

const baseMessage = {
  externalMessageId: "ext-1",
  chatwootConversationId: 42,
  senderName: "Patient",
  senderPhone: "+5511999999999",
  senderEmail: null,
  content: "Olá",
  timestamp: new Date(),
  accountId: "1",
};

function createMockDb(options: {
  duplicateWebhook?: boolean;
  conversationStatus?: "pending" | "open";
}): SupabaseClient {
  const { duplicateWebhook = false, conversationStatus = "pending" } = options;

  const from = vi.fn((table: string) => {
    if (table === "processed_webhook_events") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () =>
              duplicateWebhook ? { data: { event_id: "cw:ext-1" }, error: null } : { data: null, error: null },
            ),
          })),
        })),
        insert: vi.fn(async () => ({ data: null, error: null })),
      };
    }

    if (table === "contacts") {
      return {
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { id: "contact-1" }, error: null })),
          })),
        })),
      };
    }

    if (table === "conversations") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({
            data: { id: "conv-1", status: conversationStatus },
            error: null,
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: null, error: null })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: { id: "conv-1", status: conversationStatus },
              error: null,
            })),
          })),
        })),
      };
    }

    if (table === "messages") {
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { id: "msg-1" }, error: null })),
          })),
        })),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return { from } as unknown as SupabaseClient;
}

describe("processChatwootInboundMessage", () => {
  let emit: ReturnType<typeof vi.fn>;
  let eventBus: EventBus;

  beforeEach(() => {
    emit = vi.fn().mockResolvedValue(undefined);
    eventBus = { emit };
  });

  it("enqueues message.received for pending conversation", async () => {
    const db = createMockDb({ conversationStatus: "pending" });

    await processChatwootInboundMessage(db, "org-1", baseMessage, {}, { eventBus });

    expect(emit).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith({
      type: "message.received",
      payload: {
        orgId: "org-1",
        conversationId: "conv-1",
        messageId: "msg-1",
        correlationId: expect.any(String),
      },
    });
  });

  it("does not enqueue when conversation is open", async () => {
    const db = createMockDb({ conversationStatus: "open" });

    await processChatwootInboundMessage(db, "org-1", baseMessage, {}, { eventBus });

    expect(emit).not.toHaveBeenCalled();
  });

  it("does not enqueue duplicate webhook events", async () => {
    const db = createMockDb({ duplicateWebhook: true });

    await processChatwootInboundMessage(db, "org-1", baseMessage, {}, { eventBus });

    expect(emit).not.toHaveBeenCalled();
  });
});
