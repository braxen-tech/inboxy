import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { ensureDefaultPipeline } from "@/lib/ensure-pipeline";

const inputSchema = z.object({
  lead_id: z.string().uuid().optional().describe("ID do lead; se omitido, usa o lead da conversa"),
  stage_id: z.string().uuid().optional(),
  stage_name: z.string().optional().describe("Nome do estágio destino (ex.: Proposta)"),
});

export class MoveLeadTool implements AgentTool {
  name = "move_lead";
  description =
    "Move um lead para outro estágio do Kanban (por id ou nome do estágio). Registra activity stage_changed.";
  inputSchema = inputSchema;

  constructor(private db: SupabaseClient) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Parâmetros inválidos." });
    }

    const orgId = String(ctx.orgId);
    const pipelineId = await ensureDefaultPipeline(this.db, orgId);

    let leadId = parsed.data.lead_id;
    if (!leadId && ctx.conversationId) {
      const { data: conv } = await this.db
        .from("conversations")
        .select("lead_id")
        .eq("id", String(ctx.conversationId))
        .eq("organization_id", orgId)
        .maybeSingle();
      leadId = (conv?.lead_id as string | null) ?? undefined;
    }
    if (!leadId) {
      return Err({
        code: "VALIDATION_FAILED",
        message: "Informe lead_id ou vincule um lead à conversa.",
      });
    }

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
          message: `Estágio "${parsed.data.stage_name}" não encontrado.`,
        });
      }
      stageId = stage.id as string;
    }
    if (!stageId) {
      return Err({ code: "VALIDATION_FAILED", message: "Informe stage_id ou stage_name." });
    }

    const { data: current } = await this.db
      .from("leads")
      .select("pipeline_stage_id")
      .eq("id", leadId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!current) {
      return Err({ code: "EXECUTION_FAILED", message: "Lead não encontrado." });
    }

    const { count } = await this.db
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_stage_id", stageId);

    const { error } = await this.db
      .from("leads")
      .update({
        pipeline_stage_id: stageId,
        position: (count ?? 0) * 1000,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .eq("organization_id", orgId);

    if (error) return Err({ code: "EXECUTION_FAILED", message: error.message });

    if (current.pipeline_stage_id !== stageId) {
      await this.db.from("activities").insert({
        organization_id: orgId,
        entity_type: "lead",
        entity_id: leadId,
        type: "stage_changed",
        metadata: { from: current.pipeline_stage_id, to: stageId, source: "agent" },
      });
    }

    return Ok(`Lead ${leadId} movido para o estágio ${stageId}.`);
  }
}
