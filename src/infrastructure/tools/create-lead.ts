import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { ensureDefaultPipeline } from "@/lib/ensure-pipeline";
import { manageLeadLabels } from "@/application/services/lead-labels";

const inputSchema = z.object({
  title: z.string().min(1).max(200).describe("Título do lead"),
  value: z.number().nonnegative().optional().describe("Valor estimado em BRL"),
  stage_id: z.string().uuid().optional().describe("ID do estágio destino"),
  stage_name: z
    .string()
    .optional()
    .describe("Nome do estágio (ex.: Novo, Proposta) se stage_id não for informado"),
  tags: z
    .array(z.string())
    .optional()
    .describe("Tags iniciais (devem existir na organização)"),
  link_current_contact: z
    .boolean()
    .optional()
    .describe("Se true (padrão), vincula ao contato da conversa atual"),
});

export class CreateLeadTool implements AgentTool {
  name = "create_lead";
  description =
    "Cria um lead no Kanban. Por padrão vincula ao contato da conversa atual. Use stage_name ou stage_id.";
  inputSchema = inputSchema;

  constructor(private db: SupabaseClient) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Parâmetros inválidos." });
    }

    const orgId = String(ctx.orgId);
    const pipelineId = await ensureDefaultPipeline(this.db, orgId);

    let stageId = parsed.data.stage_id;
    if (!stageId) {
      const stageName = parsed.data.stage_name?.trim();
      if (stageName) {
        const { data: stage } = await this.db
          .from("pipeline_stages")
          .select("id")
          .eq("pipeline_id", pipelineId)
          .ilike("name", stageName)
          .maybeSingle();
        if (!stage) {
          return Err({
            code: "EXECUTION_FAILED",
            message: `Estágio "${stageName}" não encontrado. Use list_pipeline_stages.`,
          });
        }
        stageId = stage.id as string;
      } else {
        const { data: first } = await this.db
          .from("pipeline_stages")
          .select("id")
          .eq("pipeline_id", pipelineId)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!first) {
          return Err({ code: "EXECUTION_FAILED", message: "Pipeline sem estágios." });
        }
        stageId = first.id as string;
      }
    }

    const linkContact = parsed.data.link_current_contact !== false;
    let contactId = linkContact && ctx.contactId ? String(ctx.contactId) : undefined;

    if (!contactId) {
      const { data: contact, error: contactErr } = await this.db
        .from("contacts")
        .insert({ organization_id: orgId, name: parsed.data.title })
        .select("id")
        .single();
      if (contactErr || !contact) {
        return Err({
          code: "EXECUTION_FAILED",
          message: contactErr?.message ?? "Falha ao criar contato.",
        });
      }
      contactId = contact.id as string;
    }

    const { count } = await this.db
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_stage_id", stageId);

    const { data: lead, error } = await this.db
      .from("leads")
      .insert({
        organization_id: orgId,
        pipeline_id: pipelineId,
        pipeline_stage_id: stageId,
        title: parsed.data.title,
        contact_id: contactId,
        value: parsed.data.value ?? 0,
        position: (count ?? 0) * 1000,
        status: "open",
      })
      .select("id, title")
      .single();

    if (error || !lead) {
      return Err({ code: "EXECUTION_FAILED", message: error?.message ?? "Falha ao criar lead." });
    }

    if (ctx.conversationId) {
      await this.db
        .from("conversations")
        .update({ lead_id: lead.id })
        .eq("id", String(ctx.conversationId))
        .eq("organization_id", orgId)
        .is("lead_id", null);
    }

    if (parsed.data.tags?.length) {
      await manageLeadLabels({
        db: this.db,
        orgId,
        leadId: lead.id as string,
        labels: parsed.data.tags,
        action: "add",
      });
    }

    return Ok(`Lead criado: "${lead.title}" (id: ${lead.id}).`);
  }
}
