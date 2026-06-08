export const POSTHOG_DISTINCT_ID_HEADER = "x-posthog-distinct-id";
export const POSTHOG_SESSION_ID_HEADER = "x-posthog-session-id";

export function getPostHogHeadersFromRequest(request: Request): {
  distinctId?: string;
  sessionId?: string;
} {
  return {
    distinctId: request.headers.get(POSTHOG_DISTINCT_ID_HEADER) ?? undefined,
    sessionId: request.headers.get(POSTHOG_SESSION_ID_HEADER) ?? undefined,
  };
}
