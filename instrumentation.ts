import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PostHogSpanProcessor } from "@posthog/ai/otel";
import { logs } from "@opentelemetry/api-logs";
import { loggerProvider } from "@/lib/posthog-logs";
import {
  getPostHogServiceName,
  getServerDeploymentEnvironment,
} from "@/lib/deployment-environment";
import { registerPostHogAiSpanProcessor } from "@/lib/posthog-ai-traces";

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

    const spanProcessor = new PostHogSpanProcessor({
      apiKey: posthogKey,
      host: posthogHost,
    });
    registerPostHogAiSpanProcessor(spanProcessor);

    const sdk = new NodeSDK({
      resource,
      spanProcessors: [spanProcessor],
    });
    sdk.start();
  }
}
