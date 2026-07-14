import type { ChannelId, ChannelType, OrgId } from "../value-objects";

export type ChannelStatus = "pending" | "active" | "disconnected" | "error";

export interface Channel {
  id: ChannelId;
  organizationId: OrgId;
  type: ChannelType;
  status: ChannelStatus;
  metaBusinessId: string | null;
  accessToken: string | null;
  webhookVerifyToken: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  igUserId: string | null;
  igUsername: string | null;
  connectedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}
