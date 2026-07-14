import type { OrgId, PipelineId, PipelineStageId } from "../value-objects";

export interface Pipeline {
  id: PipelineId;
  organizationId: OrgId;
  name: string;
  description: string | null;
  isDefault: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineStage {
  id: PipelineStageId;
  organizationId: OrgId;
  pipelineId: PipelineId;
  name: string;
  position: number;
  color: string | null;
  isWon: boolean;
  isLost: boolean;
  createdAt: Date;
  updatedAt: Date;
}
