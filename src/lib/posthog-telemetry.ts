import { flushOtelLogs } from "@/lib/otel-logger";
import { flushPostHogAiTraces } from "@/lib/posthog-ai-traces";
import { getPostHogClient, isPostHogConfigured } from "@/lib/posthog-server";

export async function flushPostHogTelemetry(): Promise<void> {
  if (!isPostHogConfigured()) return;

  const client = getPostHogClient();
  if (client) {
    await client.flush();
  }
  await flushOtelLogs();
  await flushPostHogAiTraces();
}
