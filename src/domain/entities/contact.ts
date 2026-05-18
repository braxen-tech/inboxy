import type { ContactId, OrgId, PhoneNumber } from "../value-objects";

export interface Contact {
  id: ContactId;
  organizationId: OrgId;
  phone: PhoneNumber;
  profileName: string | null;
  name: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
