import { BatchLogRecordProcessor, LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PostHogTraceExporter } from "@posthog/ai/otel";
import { setOtelLogger, setOtelLoggerProvider } from "@/lib/otel-logger";
import {
  getPostHogServiceName,
  getServerDeploymentEnvironment,
} from "@/lib/deployment-environment";
import { logs } from "@opentelemetry/api-logs";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  const environment = getServerDeploymentEnvironment();

  const resource = resourceFromAttributes({
    "service.name": getPostHogServiceName(environment),
    "deployment.environment": environment,
  });

  if (posthogKey) {
    const logProcessor =
      process.env.VERCEL === "1"
        ? new SimpleLogRecordProcessor(
            new OTLPLogExporter({
              url: `${posthogHost}/i/v1/logs?token=${posthogKey}`,
            }),
          )
        : new BatchLogRecordProcessor(
            new OTLPLogExporter({
              url: `${posthogHost}/i/v1/logs?token=${posthogKey}`,
            }),
          );

    const provider = new LoggerProvider({
      resource,
      processors: [logProcessor],
    });
    logs.setGlobalLoggerProvider(provider);
    setOtelLoggerProvider(provider);
    setOtelLogger(logs.getLogger(getPostHogServiceName(environment)));

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
