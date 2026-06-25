/** Canonical production URL (custom domain on Vercel). */
export const PRODUCTION_APP_URL = "https://inboxy.braxentech.com";

/** Canonical app URL — set NEXT_PUBLIC_APP_URL in Vercel (e.g. https://inboxy.braxentech.com). */
export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return configured || "http://localhost:3000";
}

export function getAuthCallbackUrl(): string {
  return `${getAppUrl()}/auth/callback`;
}

export function getPasswordResetRedirectUrl(): string {
  const next = encodeURIComponent("/reset-password");
  return `${getAuthCallbackUrl()}?next=${next}`;
}
