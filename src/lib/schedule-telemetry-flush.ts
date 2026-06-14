import { after } from "next/server";
import { flushPostHogTelemetry } from "@/lib/posthog-telemetry";
import { isPostHogConfigured } from "@/lib/posthog-server";

/** Ensures batched PostHog logs/events flush before the serverless function exits. */
export function scheduleTelemetryFlush(): void {
  if (!isPostHogConfigured()) return;

  after(async () => {
    try {
      await flushPostHogTelemetry();
    } catch {
      // Telemetry flush must not affect the response.
    }
  });
}
