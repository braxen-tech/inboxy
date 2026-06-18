import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const withTracing = vi.fn((model: unknown) => ({ wrapped: true, model }));

vi.mock("@posthog/ai/vercel", () => ({
  withTracing,
}));

const isPostHogConfigured = vi.fn(() => true);
const getPostHogClient = vi.fn(() => ({ capture: vi.fn() }));

vi.mock("@/lib/posthog-server", () => ({
  isPostHogConfigured,
  getPostHogClient,
  orgDistinctId: (orgId: string) => `org:${orgId}`,
}));

describe("wrapAgentModelForPostHog", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    isPostHogConfigured.mockReturnValue(true);
    getPostHogClient.mockReturnValue({ capture: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the model unchanged when PostHog is not configured", async () => {
    isPostHogConfigured.mockReturnValue(false);
    const { wrapAgentModelForPostHog } = await import("@/lib/agent-telemetry");

    const model = { provider: "anthropic" };
    expect(
      wrapAgentModelForPostHog(model, {
        orgId: "org-1",
        conversationId: "conv-1",
        hasTools: true,
        modelName: "claude-sonnet-4-6",
      }),
    ).toBe(model);
    expect(withTracing).not.toHaveBeenCalled();
  });

  it("wraps the model with PostHog tracing when configured", async () => {
    const { wrapAgentModelForPostHog } = await import("@/lib/agent-telemetry");

    const model = { provider: "anthropic" };
    wrapAgentModelForPostHog(model, {
      orgId: "org-1",
      conversationId: "conv-1",
      hasTools: false,
      modelName: "claude-sonnet-4-6",
    });

    expect(withTracing).toHaveBeenCalledWith(
      model,
      expect.any(Object),
      expect.objectContaining({
        posthogDistinctId: "org:org-1",
        posthogTraceId: "conv-1",
        posthogCaptureImmediate: true,
        posthogProperties: {
          org_id: "org-1",
          conversation_id: "conv-1",
          has_tools: false,
          model: "claude-sonnet-4-6",
        },
      }),
    );
  });
});
