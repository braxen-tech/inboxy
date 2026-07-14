import type { OrgId } from "../value-objects";

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

  calApiKey: string | null;
  calEventTypeId: string | null;
  calTimezone: string;
  calBookingUrl: string | null;
  calStatus: CalStatus;

  followupEnabled: boolean;
  followupIdleMinutes: number;
  followupMaxPerConversation: number;

  createdAt: Date;
  updatedAt: Date;
}
