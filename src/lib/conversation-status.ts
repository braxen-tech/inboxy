/** Aligned with Chatwoot Agent Bot conversation statuses */
export type ConversationStatus = "pending" | "open" | "closed";

export const CONVERSATION_STATUSES: ConversationStatus[] = ["pending", "open", "closed"];

/** Bot (Inboxy) processes messages when conversation is in bot queue */
export function isBotQueueStatus(status: string): boolean {
  return status === "pending";
}

export function normalizeChatwootConversationStatus(
  raw: string | null | undefined,
): ConversationStatus | null {
  if (raw === "pending" || raw === "open" || raw === "closed") {
    return raw;
  }
  return null;
}
