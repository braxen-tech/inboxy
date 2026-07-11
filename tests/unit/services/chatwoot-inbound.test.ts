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
  chatwootChannel: "Channel::Whatsapp",
  chatwootInboxId: 7,
  content: "Olá",
  timestamp: new Date(),
  accountId: "1",
};

function createMockDb(options: {
  duplicateWebhook?: boolean;
  conversationStatus?: "pending" | "open";
  existingConversation?: boolean;
}): SupabaseClient {
  const {
    duplicateWebhook = false,
    conversationStatus = "pending",
    existingConversation = true,
  } = options;

  const conversationUpdates: Record<string, unknown>[] = [];
  const conversationInserts: Record<string, unknown>[] = [];

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
          maybeSingle: vi.fn(async () =>
            existingConversation
              ? {
                  data: { id: "conv-1", status: conversationStatus },
                  error: null,
                }
              : { data: null, error: null },
          ),
        })),
        update: vi.fn((payload: Record<string, unknown>) => {
          conversationUpdates.push(payload);
          return {
            eq: vi.fn(async () => ({ data: null, error: null })),
          };
        }),
        insert: vi.fn((payload: Record<string, unknown>) => {
          conversationInserts.push(payload);
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { id: "conv-1", status: conversationStatus },
                error: null,
              })),
            })),
          };
        }),
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

    if (table === "scheduled_followups") {
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    from,
    conversationUpdates,
    conversationInserts,
  } as unknown as SupabaseClient & {
    conversationUpdates: Record<string, unknown>[];
    conversationInserts: Record<string, unknown>[];
  };
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

  it("persists channel fields on existing conversation update", async () => {
    const db = createMockDb({ conversationStatus: "pending" }) as SupabaseClient & {
      conversationUpdates: Record<string, unknown>[];
    };

    await processChatwootInboundMessage(db, "org-1", baseMessage, {}, { eventBus });

    expect(db.conversationUpdates[0]).toMatchObject({
      chatwoot_channel: "Channel::Whatsapp",
      chatwoot_inbox_id: 7,
    });
  });

  it("persists channel fields on new conversation insert", async () => {
    const db = createMockDb({ existingConversation: false }) as SupabaseClient & {
      conversationInserts: Record<string, unknown>[];
    };

    await processChatwootInboundMessage(db, "org-1", baseMessage, {}, { eventBus });

    expect(db.conversationInserts[0]).toMatchObject({
      chatwoot_channel: "Channel::Whatsapp",
      chatwoot_inbox_id: 7,
    });
  });
});
