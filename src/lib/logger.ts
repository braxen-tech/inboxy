import { emitOtelLog } from "@/lib/otel-logger";
import { getPostHogTelemetryProperties } from "@/lib/deployment-environment";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  correlationId?: string;
  orgId?: string;
  conversationId?: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }

  emitOtelLog(level, message, {
    ...getPostHogTelemetryProperties(),
    ...context,
  });
}

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
};
