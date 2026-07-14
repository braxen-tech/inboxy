import type { OrgId, UserId } from "../value-objects";

export type ActivityEntityType = "lead" | "contact" | "conversation";

export type ActivityType =
  | "created"
  | "note"
  | "stage_changed"
  | "status_changed"
  | "assigned"
  | "unassigned"
  | "message_sent"
  | "message_received"
  | "tagged"
  | "untagged"
  | "won"
  | "lost";

export interface Activity {
  id: string;
  organizationId: OrgId;
  userId: UserId | null;
  entityType: ActivityEntityType;
  entityId: string;
  type: ActivityType;
  content: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
