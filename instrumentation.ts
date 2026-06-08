import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PostHogTraceExporter } from "@posthog/ai/otel";
import { setOtelLogger } from "@/lib/otel-logger";
import { logs } from "@opentelemetry/api-logs";

let loggerProvider: LoggerProvider | null = null;

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

  const resource = resourceFromAttributes({
    "service.name": "inboxy",
  });

  if (posthogKey) {
    loggerProvider = new LoggerProvider({
      resource,
      processors: [
        new BatchLogRecordProcessor(
          new OTLPLogExporter({
            url: `${posthogHost}/i/v1/logs?token=${posthogKey}`,
          }),
        ),
      ],
    });
    logs.setGlobalLoggerProvider(loggerProvider);
    setOtelLogger(logs.getLogger("inboxy"));

    const traceExporter = new PostHogTraceExporter({
      projectToken: posthogKey,
      host: posthogHost,
    });

    const sdk = new NodeSDK({
      resource,
      traceExporter,
    });
    sdk.start();
  }
}

export async function flushOtelLogs(): Promise<void> {
  if (loggerProvider) {
    await loggerProvider.forceFlush();
  }
}
