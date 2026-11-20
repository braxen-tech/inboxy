import { createHmac, timingSafeEqual } from "node:crypto";

export const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION?.trim() || "v23.0";
export const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/** Validates Meta's `X-Hub-Signature-256: sha256=<hex>` over the raw request body. */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
}

export interface PhoneNumberInfo {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
}

/** Confirms the token can read the phone number; used when connecting. */
export async function fetchPhoneNumber(
  phoneNumberId: string,
  accessToken: string,
): Promise<{ ok: true; data: PhoneNumberInfo } | { ok: false; error: string }> {
  const res = await fetch(
    `${GRAPH_BASE_URL}/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const json = (await res.json().catch(() => null)) as
    | (PhoneNumberInfo & { error?: { message?: string } })
    | null;
  if (!res.ok || !json?.id) {
    return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
  }
  return { ok: true, data: json };
}
