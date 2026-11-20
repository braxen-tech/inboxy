import type { SendError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { logger } from "@/lib/logger";

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

export interface HttpJsonResponse {
  status: number;
  body: unknown;
}

/** POST JSON with retries on network errors and 5xx; 4xx are returned as-is for the caller to map. */
export async function postJsonWithRetry(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  logLabel: string,
): Promise<Result<HttpJsonResponse, SendError>> {
  let lastError = "";
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.status < 500) return Ok({ status: res.status, body: json });
      lastError = `HTTP ${res.status}: ${JSON.stringify(json)}`;
    } catch (err) {
      lastError = String(err);
    }
    const delay = RETRY_BASE_MS * 2 ** attempt;
    logger.warn(`${logLabel} send retry`, { attempt, delay, error: lastError });
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return Err({ code: "NETWORK_ERROR", message: `Failed after ${MAX_RETRIES} retries: ${lastError}` });
}

export function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);
}
