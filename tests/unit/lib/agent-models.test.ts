import { describe, it, expect } from "vitest";
import { DEFAULT_AGENT_MODEL, resolveAgentModel } from "@/lib/agent-models";

describe("resolveAgentModel", () => {
  it("returns default for empty values", () => {
    expect(resolveAgentModel(null)).toBe(DEFAULT_AGENT_MODEL);
    expect(resolveAgentModel(undefined)).toBe(DEFAULT_AGENT_MODEL);
    expect(resolveAgentModel("  ")).toBe(DEFAULT_AGENT_MODEL);
  });

  it("maps retired Sonnet 4 to Sonnet 4.6", () => {
    expect(resolveAgentModel("claude-sonnet-4-20250514")).toBe("claude-sonnet-4-6");
  });

  it("passes through current model ids", () => {
    expect(resolveAgentModel("claude-sonnet-4-6")).toBe("claude-sonnet-4-6");
    expect(resolveAgentModel("claude-haiku-4-5-20251001")).toBe("claude-haiku-4-5-20251001");
  });
});
