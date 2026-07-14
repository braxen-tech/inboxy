import { logger } from "@/lib/logger";
import { captureServerEvent, captureServerException } from "@/lib/posthog-server";

export type TelemetryContext = {
  orgId?: string;
  conversationId?: string;
  correlationId?: string;
  messageId?: string;
} & Record<string, unknown>;

function captureCtx(ctx: TelemetryContext) {
  const { orgId, conversationId, correlationId, messageId, ...rest } = ctx;
  return {
    orgId,
    conversationId,
    correlationId,
    messageId,
    ...rest,
  };
}

/** Agent returned Err (API error, timeout, etc.) — logs + PostHog event + exception. */
export function reportAgentRunFailed(
  ctx: TelemetryContext,
  error: { code: string; message: string },
  model?: string | null,
): void {
  const payload = { ...ctx, error, model };
  logger.error("Agent run failed", payload);
  captureServerEvent("agent_run_failed", {
    ...captureCtx(ctx),
    error_code: error.code,
    error_message: error.message,
    model: model ?? undefined,
  });
  captureServerException(
    new Error(`Agent run failed [${error.code}]: ${error.message}`),
    captureCtx(ctx),
  );
}

/** Provider send failed after agent produced a reply. */
export function reportMessageSendFailed(
  ctx: TelemetryContext,
  error: { code: string; message: string },
): void {
  logger.error("Send failed", { ...ctx, error });
  captureServerEvent("message_send_failed", {
    ...captureCtx(ctx),
    error_code: error.code,
    error_message: error.message,
  });
  captureServerException(
    new Error(`Message send failed [${error.code}]: ${error.message}`),
    captureCtx(ctx),
  );
}

/** Pipeline stopped before/during processing (billing, tokens, empty reply, etc.). */
export function reportPipelineAbort(
  reason: string,
  ctx: TelemetryContext,
  level: "warn" | "error" = "warn",
): void {
  const logCtx = { ...ctx, reason };
  if (level === "error") logger.error("Message pipeline aborted", logCtx);
  else logger.warn("Message pipeline aborted", logCtx);

  captureServerEvent("message_pipeline_aborted", {
    ...captureCtx(ctx),
    reason,
    level,
  });
}

export function logWebhookIgnored(
  webhook: string,
  reason: string,
  ctx?: Record<string, unknown>,
): void {
  logger.info("Webhook ignored", { webhook, reason, ...ctx });
}

export function logWebhookHandled(
  webhook: string,
  action: string,
  ctx?: Record<string, unknown>,
): void {
  logger.info("Webhook handled", { webhook, action, ...ctx });
}

export function logAgentToolCall(
  toolName: string,
  ctx: {
    orgId: string;
    conversationId: string;
    durationMs: number;
    ok: boolean;
    errorCode?: string;
    errorMessage?: string;
  },
): void {
  const logCtx = {
    tool: toolName,
    durationMs: ctx.durationMs,
    orgId: ctx.orgId,
    conversationId: ctx.conversationId,
    ok: ctx.ok,
    ...(ctx.errorCode ? { errorCode: ctx.errorCode } : {}),
  };

  if (ctx.ok) {
    logger.info("Agent tool executed", logCtx);
  } else {
    logger.warn("Agent tool failed", {
      ...logCtx,
      errorMessage: ctx.errorMessage,
    });
    captureServerEvent("agent_tool_failed", {
      orgId: ctx.orgId,
      conversation_id: ctx.conversationId,
      tool_name: toolName,
      duration_ms: ctx.durationMs,
      error_code: ctx.errorCode,
      error_message: ctx.errorMessage,
    });
  }
}
