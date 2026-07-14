import type {
  ContactId,
  LeadId,
  OrgId,
  PipelineId,
  PipelineStageId,
  UserId,
} from "../value-objects";

export type LeadStatus = "open" | "won" | "lost";

export interface Lead {
  id: LeadId;
  organizationId: OrgId;
  contactId: ContactId;
  pipelineId: PipelineId;
  pipelineStageId: PipelineStageId;
  assignedTo: UserId | null;
  createdBy: UserId | null;
  title: string;
  description: string | null;
  value: number;
  currency: string;
  expectedCloseDate: Date | null;
  status: LeadStatus;
  lostReason: string | null;
  position: number;
  customFields: Record<string, unknown>;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
