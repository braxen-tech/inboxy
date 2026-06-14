import { PostHog } from "posthog-node";
import { getPostHogTelemetryProperties } from "@/lib/deployment-environment";

let posthogClient: PostHog | null = null;

export function isPostHogConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function getPostHogClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  if (!posthogClient) {
    posthogClient = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
}

export function orgDistinctId(orgId: string): string {
  return `org:${orgId}`;
}

type CaptureContext = {
  distinctId?: string;
  orgId?: string;
  conversationId?: string;
  correlationId?: string;
} & Record<string, unknown>;

export function captureServerEvent(
  event: string,
  properties?: CaptureContext,
  distinctId?: string,
): void {
  const client = getPostHogClient();
  if (!client) return;

  const { distinctId: propDistinctId, orgId, conversationId, correlationId, ...rest } =
    properties ?? {};

  client.capture({
    distinctId: distinctId ?? propDistinctId ?? (orgId ? orgDistinctId(orgId) : "server"),
    event,
    properties: {
      ...getPostHogTelemetryProperties(),
      ...rest,
      ...(orgId ? { org_id: orgId } : {}),
      ...(conversationId ? { conversation_id: conversationId } : {}),
      ...(correlationId ? { correlation_id: correlationId } : {}),
    },
  });
}

export function captureServerException(
  error: unknown,
  context?: CaptureContext,
): void {
  const client = getPostHogClient();
  if (!client) return;

  const err = error instanceof Error ? error : new Error(String(error));
  const { distinctId, orgId, conversationId, correlationId, ...rest } = context ?? {};

  client.captureException(err, distinctId ?? (orgId ? orgDistinctId(orgId) : "server"), {
    ...getPostHogTelemetryProperties(),
    ...rest,
    ...(orgId ? { org_id: orgId } : {}),
    ...(conversationId ? { conversation_id: conversationId } : {}),
    ...(correlationId ? { correlation_id: correlationId } : {}),
  });
}
