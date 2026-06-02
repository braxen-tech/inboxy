import type { OrgId } from "../value-objects";

export type ChatwootStatus = "pending" | "active" | "disconnected";
export type CalStatus = "pending" | "active" | "disconnected";

export interface Organization {
  id: OrgId;
  slug: string;
  name: string;
  ownerUserId: string;

  systemPrompt: string;
  knowledgeBase: string;
  model: string;
  language: string;
  toolsEnabled: string[];

  chatwootApiUrl: string | null;
  chatwootApiToken: string | null;
  chatwootAccountId: string | null;
  chatwootWebhookSecret: string | null;
  chatwootAgentBotId: string | null;
  chatwootAgentBotWebhookSecret: string | null;
  chatwootStatus: ChatwootStatus;

  calApiKey: string | null;
  calEventTypeId: string | null;
  calTimezone: string;
  calBookingUrl: string | null;
  calStatus: CalStatus;

  createdAt: Date;
  updatedAt: Date;
}
