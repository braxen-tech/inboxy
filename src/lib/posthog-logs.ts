import { BatchLogRecordProcessor, LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  getPostHogServiceName,
  getServerDeploymentEnvironment,
} from "@/lib/deployment-environment";

/** PostHog OTLP exporter — Content-Type header is required per PostHog docs. */
export function getPostHogLogsOtlpConfig(host: string, token: string) {
  return {
    url: `${host}/i/v1/logs?token=${token}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
}

export function createPostHogLogExporter(host: string, token: string): OTLPLogExporter {
  return new OTLPLogExporter(getPostHogLogsOtlpConfig(host, token));
}

function createLoggerProvider(): LoggerProvider | null {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!posthogKey) return null;

  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  const environment = getServerDeploymentEnvironment();
  const exporter = createPostHogLogExporter(posthogHost, posthogKey);

  const processor =
    process.env.VERCEL === "1"
      ? new SimpleLogRecordProcessor(exporter)
      : new BatchLogRecordProcessor(exporter);

  return new LoggerProvider({
    resource: resourceFromAttributes({
      "service.name": getPostHogServiceName(environment),
      "deployment.environment": environment,
    }),
    processors: [processor],
  });
}

/** Created at module load so route handlers can flush logs (see PostHog Next.js docs). */
export const loggerProvider = createLoggerProvider();
