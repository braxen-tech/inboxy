/** Canonical production URL (custom domain on Vercel). */
export const PRODUCTION_APP_URL = "https://inboxy.braxentech.com";

/** Canonical app URL — set NEXT_PUBLIC_APP_URL in Vercel (e.g. https://inboxy.braxentech.com). */
export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return configured || "http://localhost:3000";
}

function normalizeAppOrigin(appUrl: string): string {
  return appUrl.replace(/\/$/, "");
}

export function buildAuthCallbackUrl(appOrigin: string): string {
  return `${normalizeAppOrigin(appOrigin)}/auth/callback`;
}

export function buildPasswordResetRedirectUrl(appOrigin: string): string {
  const next = encodeURIComponent("/reset-password");
  return `${buildAuthCallbackUrl(appOrigin)}?next=${next}`;
}

export function getAuthCallbackUrl(): string {
  return buildAuthCallbackUrl(getAppUrl());
}

export function getPasswordResetRedirectUrl(): string {
  return buildPasswordResetRedirectUrl(getAppUrl());
}
