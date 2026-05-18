import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import { InMemoryToolRegistry } from "@/infrastructure/tools/registry";
import { toOrgId } from "@/domain/value-objects";
import type { AgentTool } from "@/domain/ports";
import { Ok } from "@/domain/errors";

describe("InMemoryToolRegistry", () => {
  it("returns empty array when no tools enabled", () => {
    const registry = new InMemoryToolRegistry();
    const tools = registry.getToolsForOrg(toOrgId("org-1"), []);
    expect(tools).toEqual([]);
  });

  it("returns only enabled tools for an org", () => {
    const registry = new InMemoryToolRegistry();

    const mockTool: AgentTool = {
      name: "schedule_appointment",
      description: "Schedule an appointment",
      inputSchema: z.object({ date: z.string() }),
      execute: async () => Ok("booked"),
    };

    const anotherTool: AgentTool = {
      name: "lookup_rag",
      description: "Search knowledge base",
      inputSchema: z.object({ query: z.string() }),
      execute: async () => Ok("found"),
    };

    registry.register(mockTool);
    registry.register(anotherTool);

    const tools = registry.getToolsForOrg(toOrgId("org-1"), ["schedule_appointment"]);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("schedule_appointment");
  });

  it("ignores unknown tool names", () => {
    const registry = new InMemoryToolRegistry();
    const tools = registry.getToolsForOrg(toOrgId("org-1"), ["nonexistent_tool"]);
    expect(tools).toEqual([]);
  });
});
