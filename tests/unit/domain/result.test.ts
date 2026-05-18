import { describe, it, expect } from "vitest";
import { Ok, Err, type Result } from "@/domain/errors";

describe("Result type", () => {
  it("Ok wraps a value", () => {
    const result: Result<number, string> = Ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it("Err wraps an error", () => {
    const result: Result<number, string> = Err("something failed");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("something failed");
    }
  });

  it("can be narrowed with ok check", () => {
    const result: Result<string, Error> = Ok("hello");
    if (result.ok) {
      const val: string = result.value;
      expect(val).toBe("hello");
    }
  });
});
