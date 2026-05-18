import type { z } from "zod/v4";
import type { Result } from "../errors";
import type { OrgId } from "../value-objects";

export interface CalendarContext {
  eventTypeId: string;
  apiToken: string;
  timezone: string;
  bookingUrl: string | null;
}

export interface ToolContext {
  orgId: OrgId;
  contactPhone: string;
  conversationId: string;
  calendar?: CalendarContext;
}

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>>;
}

export type ToolError = { code: "EXECUTION_FAILED" | "VALIDATION_FAILED"; message: string };

export interface ToolRegistry {
  getToolsForOrg(orgId: OrgId, enabledTools: string[]): AgentTool[];
  register(tool: AgentTool): void;
}
