import type { ContactId, OrgId, PhoneNumber } from "../value-objects";

export interface Contact {
  id: ContactId;
  organizationId: OrgId;
  phone: PhoneNumber | null;
  profileName: string | null;
  name: string | null;
  email: string | null;
  notes: string | null;
  avatarUrl: string | null;
  igUserId: string | null;
  igUsername: string | null;
  customFields: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
