import { describe, it, expect } from "vitest";
import {
  isRetryableVoyageStatus,
  parseRetryAfterMs,
} from "@/infrastructure/adapters/voyage/embedding-adapter";

describe("Voyage embedding adapter helpers", () => {
  it("detects retryable HTTP statuses", () => {
    expect(isRetryableVoyageStatus(429)).toBe(true);
    expect(isRetryableVoyageStatus(503)).toBe(true);
    expect(isRetryableVoyageStatus(400)).toBe(false);
  });

  it("parses Retry-After seconds", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
  });

  it("returns null for invalid Retry-After", () => {
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs("not-a-date")).toBeNull();
  });
});
