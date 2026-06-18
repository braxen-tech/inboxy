import { OpenTelemetryIntegration } from "@ai-sdk/otel";
import type { TelemetrySettings } from "ai";
import { isPostHogConfigured, orgDistinctId } from "@/lib/posthog-server";

const otelIntegration = new OpenTelemetryIntegration();

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
    integrations: otelIntegration,
    metadata: {
      posthog_distinct_id: orgDistinctId(input.orgId),
      org_id: input.orgId,
      conversation_id: input.conversationId,
      has_tools: String(input.hasTools),
      model: input.model,
    },
  };
}
