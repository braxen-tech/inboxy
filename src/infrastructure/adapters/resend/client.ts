import { Resend } from "resend";

let cached: Resend | null = null;

/** Returns a memoized Resend client, or null when RESEND_API_KEY is not configured. */
export function getResendClient(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  cached = new Resend(key);
  return cached;
}

export function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || "Inboxy <notifications@inboxy.app>";
}
