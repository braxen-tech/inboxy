import type { Result } from "../errors";
import type { Message } from "../entities";
import type { OrgId } from "../value-objects";
import type { AgentTool, ToolContext } from "./tool-registry";

export interface AgentRunParams {
  systemPrompt: string;
  knowledgeBase: string;
  history: Message[];
  tools: AgentTool[];
  toolContext: ToolContext;
  orgId: OrgId;
  model: string;
  language: string;
  availableLabels?: string[];
  availableAgents?: { name: string; email?: string }[];
}

export interface AgentOutput {
  reply: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export type AgentError = { code: "TIMEOUT" | "TOKEN_LIMIT" | "API_ERROR"; message: string };

export interface AgentRunner {
  run(params: AgentRunParams): Promise<Result<AgentOutput, AgentError>>;
}
