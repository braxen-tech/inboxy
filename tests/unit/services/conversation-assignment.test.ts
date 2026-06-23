import { describe, it, expect } from "vitest";
import { resolveAgentByName } from "@/application/services/conversation-assignment";

const agents = [
  { id: 10, name: "Ana Silva", email: "ana@example.com" },
  { id: 11, name: "Carlos Mendes", email: "carlos@example.com" },
  { id: 12, name: "Ana Costa", email: "ana.costa@example.com" },
];

describe("resolveAgentByName", () => {
  it("matches exact name case-insensitively", () => {
    const result = resolveAgentByName("ana silva", agents);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.agent.id).toBe(10);
  });

  it("returns error for unknown agent", () => {
    const result = resolveAgentByName("Inexistente", agents);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Inexistente");
      expect(result.available).toContain("Ana Silva");
    }
  });

  it("returns error for ambiguous partial name", () => {
    const result = resolveAgentByName("Ana", agents);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("ambíguo");
  });
});
