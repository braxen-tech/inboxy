import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { manageLeadLabels } from "@/application/services/lead-labels";

const inputSchema = z.object({
  labels: z
    .array(z.string().min(1))
    .min(1)
    .describe('Tags a aplicar ou remover no lead (ex.: ["quente"])'),
  action: z.enum(["add", "remove"]).default("add"),
  lead_id: z
    .string()
    .uuid()
    .optional()
    .describe("ID do lead; se omitido, usa o lead vinculado à conversa atual"),
  reason: z.string().optional(),
});

export class ManageLeadTagsTool implements AgentTool {
  name = "manage_lead_tags";
  description =
    "Aplica ou remove tags no lead do Kanban (não na conversa). Use tags existentes da organização. " +
    "Para tags da thread use manage_conversation_tags. Se a conversa tiver lead vinculado, lead_id pode ser omitido.";
  inputSchema = inputSchema;

  constructor(private db: SupabaseClient) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Parâmetros inválidos." });
    }

    const orgId = String(ctx.orgId);
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
        message:
          "Nenhum lead vinculado. Informe lead_id ou crie um lead com create_lead nesta conversa.",
      });
    }

    const result = await manageLeadLabels({
      db: this.db,
      orgId,
      leadId,
      labels: parsed.data.labels,
      action: parsed.data.action,
      logContext: {
        orgId,
        leadId,
        reason: parsed.data.reason ?? "agent_classification",
      },
    });

    if (!result.ok) {
      return Err({ code: "EXECUTION_FAILED", message: result.error });
    }

    const actionText =
      parsed.data.action === "remove"
        ? `Tags removidas do lead: ${parsed.data.labels.join(", ")}.`
        : `Tags aplicadas no lead: ${parsed.data.labels.join(", ")}.`;

    return Ok(
      `${actionText} Tags atuais do lead: ${result.labels.join(", ") || "(nenhuma)"}. Continue o atendimento normalmente.`,
    );
  }
}
