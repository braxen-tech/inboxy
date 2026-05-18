/**
 * Simple in-memory rate limiter using sliding window counters.
 * Good enough for MVP single-instance deployment.
 * For multi-instance, replace with Redis-based limiter.
 */

interface Window {
  count: number;
  startedAt: number;
}

export class RateLimiter {
  private windows = new Map<string, Window>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(opts: { maxRequests: number; windowMs: number }) {
    this.maxRequests = opts.maxRequests;
    this.windowMs = opts.windowMs;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const window = this.windows.get(key);

    if (!window || now - window.startedAt > this.windowMs) {
      this.windows.set(key, { count: 1, startedAt: now });
      return true;
    }

    if (window.count >= this.maxRequests) {
      return false;
    }

    window.count++;
    return true;
  }

  reset(key: string): void {
    this.windows.delete(key);
  }
}

export const webhookRateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60_000,
});

export const apiRateLimiter = new RateLimiter({
  maxRequests: 30,
  windowMs: 60_000,
});
