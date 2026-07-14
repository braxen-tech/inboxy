import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { ensureDefaultPipeline } from "@/lib/ensure-pipeline";

export class ListPipelineStagesTool implements AgentTool {
  name = "list_pipeline_stages";
  description =
    "Lista os estágios (colunas) do pipeline padrão da organização — use antes de criar ou mover leads.";
  inputSchema = z.object({});

  constructor(private db: SupabaseClient) {}

  async execute(ctx: ToolContext, _input: unknown): Promise<Result<string, ToolError>> {
    const orgId = String(ctx.orgId);
    const pipelineId = await ensureDefaultPipeline(this.db, orgId);
    const { data: stages, error } = await this.db
      .from("pipeline_stages")
      .select("id, name, position")
      .eq("pipeline_id", pipelineId)
      .order("position", { ascending: true });

    if (error) return Err({ code: "EXECUTION_FAILED", message: error.message });

    const lines = (stages ?? []).map(
      (s) => `- ${s.name} (id: ${s.id}, posição: ${s.position})`,
    );
    return Ok(
      lines.length > 0
        ? `Estágios do pipeline:\n${lines.join("\n")}`
        : "Nenhum estágio configurado no pipeline.",
    );
  }
}
