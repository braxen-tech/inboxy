/** CRM conversation lifecycle */
export type ConversationStatus = "pending" | "open" | "snoozed" | "resolved" | "closed";

export const CONVERSATION_STATUSES: ConversationStatus[] = [
  "pending",
  "open",
  "snoozed",
  "resolved",
  "closed",
];

/** Bot (Inboxy) processes messages while conversation is in bot queue */
export function isBotQueueStatus(status: string): boolean {
  return status === "pending";
}
