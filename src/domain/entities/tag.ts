import type { OrgId, TagId } from "../value-objects";

export interface Tag {
  id: TagId;
  organizationId: OrgId;
  name: string;
  color: string;
  createdAt: Date;
}
