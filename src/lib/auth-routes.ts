/** Path prefixes that skip auth middleware (login, webhooks, password recovery request, etc.). */
export const AUTH_PUBLIC_PATH_PREFIXES = [
  "/login",
  "/forgot-password",
  "/auth/callback",
  "/api/auth",
  "/api/webhooks",
  "/api/health",
  "/api/inngest",
] as const;

/** Top-level routes that must not be treated as organization slugs. */
export const AUTH_RESERVED_SLUGS = new Set([
  "login",
  "auth",
  "api",
  "forgot-password",
  "reset-password",
]);

export function isAuthPublicPath(pathname: string): boolean {
  return AUTH_PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isReservedAppSlug(slug: string): boolean {
  return AUTH_RESERVED_SLUGS.has(slug);
}

/** Safe post-auth redirect target from `/auth/callback?next=...`. */
export function getAuthCallbackRedirectTarget(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}
