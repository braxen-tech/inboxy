import type { PostHogSpanProcessor } from "@posthog/ai/otel";

let posthogSpanProcessor: PostHogSpanProcessor | null = null;

export function registerPostHogAiSpanProcessor(processor: PostHogSpanProcessor): void {
  posthogSpanProcessor = processor;
}

export async function flushPostHogAiTraces(): Promise<void> {
  if (!posthogSpanProcessor) return;
  await posthogSpanProcessor.forceFlush();
}
