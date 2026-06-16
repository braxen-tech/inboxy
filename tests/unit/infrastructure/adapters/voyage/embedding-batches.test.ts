import { describe, it, expect } from "vitest";
import {
  buildEmbeddingBatches,
  estimateTokenCount,
} from "@/infrastructure/adapters/voyage/embedding-batches";

describe("buildEmbeddingBatches", () => {
  it("returns empty for no texts", () => {
    expect(buildEmbeddingBatches([])).toEqual([]);
  });

  it("keeps small inputs in a single batch", () => {
    expect(buildEmbeddingBatches(["hello", "world"])).toEqual([["hello", "world"]]);
  });

  it("splits when exceeding max item count", () => {
    const texts = Array.from({ length: 10 }, (_, i) => `chunk-${i}`);
    const batches = buildEmbeddingBatches(texts);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(8);
    expect(batches[1]).toHaveLength(2);
  });

  it("splits when estimated tokens exceed limit", () => {
    const heavy = "x".repeat(100_000);
    const batches = buildEmbeddingBatches([heavy, heavy]);
    expect(batches).toHaveLength(2);
  });

  it("estimates tokens from char length", () => {
    expect(estimateTokenCount("abc")).toBe(1);
    expect(estimateTokenCount("x".repeat(300))).toBe(100);
  });
});
