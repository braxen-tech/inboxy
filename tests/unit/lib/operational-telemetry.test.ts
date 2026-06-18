import { describe, it, expect, vi, beforeEach } from "vitest";

const { captureServerEvent, captureServerException } = vi.hoisted(() => ({
  captureServerEvent: vi.fn(),
  captureServerException: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/posthog-server", () => ({
  captureServerEvent,
  captureServerException,
}));

import { logger } from "@/lib/logger";
import {
  logAgentToolCall,
  logWebhookIgnored,
  reportAgentRunFailed,
  reportPipelineAbort,
} from "@/lib/operational-telemetry";

describe("operational-telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reportAgentRunFailed logs and sends PostHog event + exception", () => {
    reportAgentRunFailed(
      { orgId: "org-1", correlationId: "corr-1" },
      { code: "API_ERROR", message: "model not found" },
      "claude-sonnet-4-6",
    );

    expect(logger.error).toHaveBeenCalled();
    expect(captureServerEvent).toHaveBeenCalledWith(
      "agent_run_failed",
      expect.objectContaining({
        orgId: "org-1",
        error_code: "API_ERROR",
        model: "claude-sonnet-4-6",
      }),
    );
    expect(captureServerException).toHaveBeenCalled();
  });

  it("reportPipelineAbort emits message_pipeline_aborted", () => {
    reportPipelineAbort("billing_setup_incomplete", { orgId: "org-1" });

    expect(logger.warn).toHaveBeenCalled();
    expect(captureServerEvent).toHaveBeenCalledWith(
      "message_pipeline_aborted",
      expect.objectContaining({ reason: "billing_setup_incomplete", orgId: "org-1" }),
    );
  });

  it("logWebhookIgnored writes structured info log", () => {
    logWebhookIgnored("chatwoot/agent-bot", "outgoing_message", { accountId: "1" });

    expect(logger.info).toHaveBeenCalledWith("Webhook ignored", {
      webhook: "chatwoot/agent-bot",
      reason: "outgoing_message",
      accountId: "1",
    });
  });

  it("logAgentToolCall emits agent_tool_failed only on error", () => {
    logAgentToolCall("lookup_knowledge", {
      orgId: "org-1",
      conversationId: "conv-1",
      durationMs: 42,
      ok: true,
    });
    expect(captureServerEvent).not.toHaveBeenCalled();

    logAgentToolCall("lookup_knowledge", {
      orgId: "org-1",
      conversationId: "conv-1",
      durationMs: 99,
      ok: false,
      errorCode: "EXECUTION_FAILED",
      errorMessage: "timeout",
    });
    expect(captureServerEvent).toHaveBeenCalledWith(
      "agent_tool_failed",
      expect.objectContaining({ tool_name: "lookup_knowledge", error_code: "EXECUTION_FAILED" }),
    );
  });
});
