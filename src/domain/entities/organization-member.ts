import type { OrgId, UserId } from "../value-objects";

export type MemberRole = "admin" | "agent" | "viewer";

export interface OrganizationMember {
  id: string;
  organizationId: OrgId;
  userId: UserId;
  role: MemberRole;
  invitedBy: UserId | null;
  joinedAt: Date;
  createdAt: Date;
}

export interface OrganizationInvite {
  id: string;
  organizationId: OrgId;
  email: string;
  role: MemberRole;
  token: string;
  invitedBy: UserId | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}
