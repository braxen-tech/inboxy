import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Validates the X-Hub-Signature-256 header from Meta webhooks.
 * Meta signs the raw request body with the App Secret using HMAC-SHA256.
 * Header format: "sha256=<hex>"
 */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith("sha256=")) return false;

  const provided = header.slice("sha256=".length);
  const computed = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  if (provided.length !== computed.length) return false;

  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(computed, "hex"));
  } catch {
    return false;
  }
}

/**
 * Constant-time comparison of the webhook GET verification token.
 */
export function verifyChallengeToken(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}
