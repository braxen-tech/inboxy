import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { logger } from "@/lib/logger";

const inputSchema = z.object({
  name: z.string().min(1).optional().describe("Nome completo informado pelo cliente"),
  email: z.string().email().optional().describe("Email do cliente"),
  notes: z.string().optional().describe("Observações relevantes sobre o cliente"),
  custom_fields: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .describe("Campos customizados coletados na conversa (ex.: origem, interesse, etc.)"),
});

export class UpdateContactTool implements AgentTool {
  name = "update_contact";
  description =
    "Atualiza dados do contato no CRM (nome, email, notas, campos customizados) quando o cliente informar essas informações durante a conversa.";
  inputSchema = inputSchema;

  constructor(private db: SupabaseClient) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Parâmetros inválidos." });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.name) update.name = parsed.data.name;
    if (parsed.data.email) update.email = parsed.data.email;
    if (parsed.data.notes) update.notes = parsed.data.notes;

    if (parsed.data.custom_fields && Object.keys(parsed.data.custom_fields).length > 0) {
      const { data: current } = await this.db
        .from("contacts")
        .select("custom_fields")
        .eq("id", String(ctx.contactId))
        .single();

      const merged = {
        ...((current?.custom_fields as Record<string, unknown> | null) ?? {}),
        ...parsed.data.custom_fields,
      };
      update.custom_fields = merged;
    }

    const { error } = await this.db
      .from("contacts")
      .update(update)
      .eq("id", String(ctx.contactId))
      .eq("organization_id", String(ctx.orgId));

    if (error) {
      logger.warn("Failed to update contact via tool", { error: error.message, orgId: ctx.orgId });
      return Err({ code: "EXECUTION_FAILED", message: "Não foi possível atualizar o contato." });
    }

    return Ok("Dados do contato atualizados no CRM.");
  }
}
