import { logs, SeverityNumber, type Logger } from "@opentelemetry/api-logs";

let otelLogger: Logger | null = null;

export function setOtelLogger(logger: Logger): void {
  otelLogger = logger;
}

export function getOtelLogger(): Logger | null {
  return otelLogger;
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
  if (!otelLogger) return;

  const severity = SEVERITY[level];
  otelLogger.emit({
    body: message,
    severityNumber: severity.number,
    severityText: severity.text,
    attributes: attributes as Record<string, string | number | boolean>,
  });
}
