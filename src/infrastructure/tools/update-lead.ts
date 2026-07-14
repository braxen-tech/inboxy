import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";

const inputSchema = z.object({
  lead_id: z.string().uuid().optional().describe("ID do lead; se omitido, usa o lead vinculado à conversa"),
  title: z.string().min(1).max(200).optional(),
  value: z.number().nonnegative().optional(),
  status: z.enum(["open", "won", "lost"]).optional(),
  description: z.string().max(5000).optional(),
});

export class UpdateLeadTool implements AgentTool {
  name = "update_lead";
  description =
    "Atualiza título, valor, descrição ou status (open/won/lost) de um lead. Prefira status=lost a delete_lead.";
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
        message: "Informe lead_id ou vincule um lead à conversa com create_lead.",
      });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.value !== undefined) patch.value = parsed.data.value;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.status !== undefined) {
      patch.status = parsed.data.status;
      patch.closed_at =
        parsed.data.status === "won" || parsed.data.status === "lost"
          ? new Date().toISOString()
          : null;
    }

    if (Object.keys(patch).length <= 1) {
      return Err({ code: "VALIDATION_FAILED", message: "Nenhum campo para atualizar." });
    }

    const { error } = await this.db
      .from("leads")
      .update(patch)
      .eq("id", leadId)
      .eq("organization_id", orgId);

    if (error) return Err({ code: "EXECUTION_FAILED", message: error.message });
    return Ok(`Lead ${leadId} atualizado.`);
  }
}
