import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { ensureDefaultPipeline } from "@/lib/ensure-pipeline";

const inputSchema = z.object({
  stage_id: z.string().uuid().optional().describe("Filtrar por ID do estágio"),
  stage_name: z.string().optional().describe("Filtrar por nome do estágio (ex.: Proposta)"),
  status: z.enum(["open", "won", "lost"]).optional().describe("Status do lead; padrão open"),
  limit: z.number().int().min(1).max(50).optional().describe("Máximo de leads (padrão 20)"),
});

export class ListLeadsTool implements AgentTool {
  name = "list_leads";
  description =
    "Lista leads do pipeline (título, valor, estágio, status). Filtre por estágio ou status.";
  inputSchema = inputSchema;

  constructor(private db: SupabaseClient) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Parâmetros inválidos." });
    }

    const orgId = String(ctx.orgId);
    const pipelineId = await ensureDefaultPipeline(this.db, orgId);
    const status = parsed.data.status ?? "open";
    const limit = parsed.data.limit ?? 20;

    let stageId = parsed.data.stage_id;
    if (!stageId && parsed.data.stage_name) {
      const { data: stage } = await this.db
        .from("pipeline_stages")
        .select("id, name")
        .eq("pipeline_id", pipelineId)
        .ilike("name", parsed.data.stage_name.trim())
        .maybeSingle();
      if (!stage) {
        return Err({
          code: "EXECUTION_FAILED",
          message: `Estágio "${parsed.data.stage_name}" não encontrado. Use list_pipeline_stages.`,
        });
      }
      stageId = stage.id as string;
    }

    let q = this.db
      .from("leads")
      .select("id, title, value, status, pipeline_stage_id, pipeline_stages(name)")
      .eq("organization_id", orgId)
      .eq("pipeline_id", pipelineId)
      .eq("status", status)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (stageId) q = q.eq("pipeline_stage_id", stageId);

    const { data, error } = await q;
    if (error) return Err({ code: "EXECUTION_FAILED", message: error.message });

    if (!data?.length) return Ok("Nenhum lead encontrado com esses filtros.");

    const lines = data.map((l) => {
      const stage = Array.isArray(l.pipeline_stages) ? l.pipeline_stages[0] : l.pipeline_stages;
      const stageName = (stage as { name?: string } | null)?.name ?? l.pipeline_stage_id;
      return `- ${l.title} | ${stageName} | R$ ${l.value ?? 0} | status=${l.status} | id=${l.id}`;
    });

    return Ok(`Leads (${lines.length}):\n${lines.join("\n")}`);
  }
}
