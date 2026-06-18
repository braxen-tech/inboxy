import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PostHogTraceExporter } from "@posthog/ai/otel";
import { logs } from "@opentelemetry/api-logs";
import { loggerProvider } from "@/lib/posthog-logs";
import {
  getPostHogServiceName,
  getServerDeploymentEnvironment,
} from "@/lib/deployment-environment";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  const environment = getServerDeploymentEnvironment();

  if (loggerProvider) {
    logs.setGlobalLoggerProvider(loggerProvider);
  }

  if (posthogKey) {
    const resource = resourceFromAttributes({
      "service.name": getPostHogServiceName(environment),
      "deployment.environment": environment,
    });

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
