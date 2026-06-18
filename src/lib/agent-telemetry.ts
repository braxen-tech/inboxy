import { withTracing } from "@posthog/ai/vercel";
import { getPostHogClient, isPostHogConfigured, orgDistinctId } from "@/lib/posthog-server";

/** Wraps a Vercel AI model so PostHog captures $ai_generation events directly. */
export function wrapAgentModelForPostHog<T extends Parameters<typeof withTracing>[0]>(
  model: T,
  input: {
    orgId: string;
    conversationId: string;
    hasTools: boolean;
    modelName: string;
  },
): T {
  if (!isPostHogConfigured()) return model;

  const client = getPostHogClient();
  if (!client) return model;

  return withTracing(model, client, {
    posthogDistinctId: orgDistinctId(input.orgId),
    posthogTraceId: input.conversationId,
    posthogProperties: {
      org_id: input.orgId,
      conversation_id: input.conversationId,
      has_tools: input.hasTools,
      model: input.modelName,
    },
    posthogCaptureImmediate: true,
  });
}
