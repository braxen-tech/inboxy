/** Canonical app URL — set NEXT_PUBLIC_APP_URL in Vercel (e.g. https://inboxy.braxentech.com). */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getAuthCallbackUrl(): string {
  return `${getAppUrl()}/auth/callback`;
}
