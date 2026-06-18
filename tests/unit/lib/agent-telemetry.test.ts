import { afterEach, describe, expect, it, vi } from "vitest";

describe("buildAgentTelemetrySettings", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns undefined when PostHog is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const { buildAgentTelemetrySettings } = await import("@/lib/agent-telemetry");

    expect(
      buildAgentTelemetrySettings({
        orgId: "org-1",
        conversationId: "conv-1",
        hasTools: true,
        model: "claude-sonnet-4-6",
      }),
    ).toBeUndefined();
  });

  it("returns telemetry settings with org distinct id when PostHog is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    const { buildAgentTelemetrySettings } = await import("@/lib/agent-telemetry");

    const settings = buildAgentTelemetrySettings({
      orgId: "org-1",
      conversationId: "conv-1",
      hasTools: false,
      model: "claude-sonnet-4-6",
    });

    expect(settings?.isEnabled).toBe(true);
    expect(settings?.functionId).toBe("inboxy-agent-reply");
    expect(settings?.metadata).toMatchObject({
      posthog_distinct_id: "org:org-1",
      org_id: "org-1",
      conversation_id: "conv-1",
      has_tools: "false",
      model: "claude-sonnet-4-6",
    });
  });
});
