import type { OrgId, UserId } from "../value-objects";

export type NotificationType =
  | "new_message"
  | "assigned"
  | "mention"
  | "lead_stage_changed"
  | "invite";

export type NotificationEntityType = "lead" | "contact" | "conversation" | "organization";

export interface Notification {
  id: string;
  organizationId: OrgId;
  userId: UserId;
  type: NotificationType;
  title: string;
  body: string | null;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  readAt: Date | null;
  createdAt: Date;
}
