import { SeverityNumber } from "@opentelemetry/api-logs";
import { loggerProvider } from "@/lib/posthog-logs";
import {
  getPostHogServiceName,
  getServerDeploymentEnvironment,
} from "@/lib/deployment-environment";

export async function flushOtelLogs(): Promise<void> {
  if (loggerProvider) {
    await loggerProvider.forceFlush();
  }
}

const SEVERITY: Record<string, { number: SeverityNumber; text: string }> = {
  debug: { number: SeverityNumber.DEBUG, text: "DEBUG" },
  info: { number: SeverityNumber.INFO, text: "INFO" },
  warn: { number: SeverityNumber.WARN, text: "WARN" },
  error: { number: SeverityNumber.ERROR, text: "ERROR" },
};

export function emitOtelLog(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  attributes?: Record<string, unknown>,
): void {
  if (!loggerProvider) return;

  const logger = loggerProvider.getLogger(getPostHogServiceName(getServerDeploymentEnvironment()));
  const severity = SEVERITY[level];
  logger.emit({
    body: message,
    severityNumber: severity.number,
    severityText: severity.text,
    attributes: attributes as Record<string, string | number | boolean>,
  });
}
