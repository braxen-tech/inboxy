import type { z } from "zod/v4";
import type { Result } from "../errors";
import type { OrgId } from "../value-objects";

export interface CalendarContext {
  eventTypeId: string;
  apiToken: string;
  timezone: string;
  bookingUrl: string | null;
}

export interface AsaasContext {
  /** Subconta API key for the org (encrypted at rest, decrypted at runtime) */
  apiKey: string;
}

export interface ChatwootContext {
  apiUrl: string;
  /** Admin API token */
  apiToken: string;
  botAccessToken?: string | null;
  accountId: string;
  conversationId: number;
  /** Chatwoot contact ID from local metadata or conversation API */
  contactId?: number;
}

export interface ToolContext {
  orgId: OrgId;
  contactPhone: string;
  conversationId: string;
  /** Local Supabase contact row ID */
  localContactId?: string;
  calendar?: CalendarContext;
  asaas?: AsaasContext;
  chatwoot?: ChatwootContext;
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
