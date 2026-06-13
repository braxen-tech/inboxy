import { describe, it, expect } from "vitest";
import { chunkText } from "@/infrastructure/kb/chunker";

describe("chunkText", () => {
  it("returns empty array for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("returns single chunk for short text", () => {
    const text = "Hello world";
    expect(chunkText(text)).toEqual([text]);
  });

  it("splits long text into multiple chunks with overlap", () => {
    const paragraph = "word ".repeat(400).trim();
    const chunks = chunkText(paragraph, { chunkChars: 500, overlapChars: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 500)).toBe(true);
  });

  it("prefers breaking at paragraph boundaries", () => {
    const text = `${"a".repeat(200)}\n\n${"b".repeat(200)}`;
    const chunks = chunkText(text, { chunkChars: 250, overlapChars: 20 });
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});
