import type { OrgId } from "../value-objects";

export type WhatsAppStatus = "pending" | "active" | "disconnected";

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

  createdAt: Date;
  updatedAt: Date;
}
