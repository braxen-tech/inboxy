import type { TelemetrySettings } from "ai";
import { isPostHogConfigured, orgDistinctId } from "@/lib/posthog-server";

export function buildAgentTelemetrySettings(input: {
  orgId: string;
  conversationId: string;
  hasTools: boolean;
  model: string;
  functionId?: string;
}): TelemetrySettings | undefined {
  if (!isPostHogConfigured()) return undefined;

  return {
    isEnabled: true,
    functionId: input.functionId ?? "inboxy-agent-reply",
    metadata: {
      posthog_distinct_id: orgDistinctId(input.orgId),
      org_id: input.orgId,
      conversation_id: input.conversationId,
      has_tools: String(input.hasTools),
      model: input.model,
    },
  };
}
