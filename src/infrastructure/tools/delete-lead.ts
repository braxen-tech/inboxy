import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";

const inputSchema = z.object({
  lead_id: z.string().uuid().optional(),
  confirm: z
    .boolean()
    .describe("Deve ser true para confirmar exclusão permanente. Prefira update_lead com status=lost."),
});

export class DeleteLeadTool implements AgentTool {
  name = "delete_lead";
  description =
    "Exclui um lead permanentemente. Prefira update_lead com status=lost. Só use se o usuário pedir exclusão clara e confirme com confirm=true.";
  inputSchema = inputSchema;

  constructor(private db: SupabaseClient) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Parâmetros inválidos." });
    }
    if (!parsed.data.confirm) {
      return Err({
        code: "VALIDATION_FAILED",
        message: "Para excluir, passe confirm=true. Prefira marcar o lead como lost.",
      });
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
      return Err({ code: "VALIDATION_FAILED", message: "Informe lead_id." });
    }

    const { error } = await this.db
      .from("leads")
      .delete()
      .eq("id", leadId)
      .eq("organization_id", orgId);

    if (error) return Err({ code: "EXECUTION_FAILED", message: error.message });
    return Ok(`Lead ${leadId} excluído.`);
  }
}
