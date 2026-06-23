import { describe, it, expect } from "vitest";
import { buildHandoffSystemInstructions } from "@/lib/handoff";

describe("handoff", () => {
  it("always requires explicit customer request as default trigger", () => {
    const lines = buildHandoffSystemInstructions();
    const text = lines.join(" ");
    expect(text).toContain("pedir explicitamente");
    expect(text).toContain("não pode ser ignorado");
  });

  it("honors custom handoff rules from org system prompt", () => {
    const lines = buildHandoffSystemInstructions();
    const text = lines.join(" ");
    expect(text).toContain("prompt da organização");
    expect(text).not.toContain("frustração");
  });

  it("includes available agents when provided", () => {
    const lines = buildHandoffSystemInstructions([
      { name: "Ana Silva", email: "ana@example.com" },
    ]);
    expect(lines.some((line) => line.includes('"Ana Silva"'))).toBe(true);
    expect(lines.some((line) => line.includes("assignee_name"))).toBe(true);
  });
});
