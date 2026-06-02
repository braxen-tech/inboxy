import { describe, it, expect } from "vitest";
import {
  isBotQueueStatus,
  normalizeChatwootConversationStatus,
} from "@/lib/conversation-status";

describe("conversation-status", () => {
  it("isBotQueueStatus is true only for pending", () => {
    expect(isBotQueueStatus("pending")).toBe(true);
    expect(isBotQueueStatus("open")).toBe(false);
    expect(isBotQueueStatus("closed")).toBe(false);
    expect(isBotQueueStatus("active")).toBe(false);
  });

  it("normalizeChatwootConversationStatus accepts pending, open, closed", () => {
    expect(normalizeChatwootConversationStatus("pending")).toBe("pending");
    expect(normalizeChatwootConversationStatus("open")).toBe("open");
    expect(normalizeChatwootConversationStatus("closed")).toBe("closed");
    expect(normalizeChatwootConversationStatus("resolved")).toBeNull();
    expect(normalizeChatwootConversationStatus(undefined)).toBeNull();
  });
});
