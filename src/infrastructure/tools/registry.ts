import type { AgentTool, ToolRegistry } from "@/domain/ports";
import type { OrgId } from "@/domain/value-objects";

export class InMemoryToolRegistry implements ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  getToolsForOrg(_orgId: OrgId, enabledTools: string[]): AgentTool[] {
    if (enabledTools.length === 0) return [];
    return enabledTools
      .map((name) => this.tools.get(name))
      .filter((t): t is AgentTool => t !== undefined);
  }
}
