import type { OrgId } from "../value-objects";

export type WhatsAppStatus = "pending" | "active" | "disconnected";
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

  whatsappBusinessAccountId: string | null;
  whatsappPhoneNumberId: string | null;
  whatsappPhoneNumber: string | null;
  whatsappAccessToken: string | null;
  whatsappPin: string | null;
  whatsappStatus: WhatsAppStatus;

  calApiKey: string | null;
  calEventTypeId: string | null;
  calTimezone: string;
  calBookingUrl: string | null;
  calStatus: CalStatus;

  createdAt: Date;
  updatedAt: Date;
}
