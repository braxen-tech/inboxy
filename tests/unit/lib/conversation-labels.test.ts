import { describe, it, expect } from "vitest";
import { buildConversationLabelSystemInstructions } from "@/lib/conversation-labels";

describe("buildConversationLabelSystemInstructions", () => {
  it("includes available labels when provided", () => {
    const lines = buildConversationLabelSystemInstructions(["interessado", "quente"]);
    expect(lines.some((line) => line.includes('"interessado"'))).toBe(true);
    expect(lines.some((line) => line.includes('"quente"'))).toBe(true);
  });

  it("warns when no labels exist", () => {
    const lines = buildConversationLabelSystemInstructions([]);
    expect(lines.some((line) => line.includes("Nenhuma label"))).toBe(true);
  });
});
