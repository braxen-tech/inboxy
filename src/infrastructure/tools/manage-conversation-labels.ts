import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { manageConversationLabels } from "@/application/services/conversation-labels";

const inputSchema = z.object({
  labels: z
    .array(z.string().min(1))
    .min(1)
    .describe('Tags a aplicar ou remover (ex.: ["quente", "interessado"])'),
  action: z
    .enum(["add", "remove"])
    .default("add")
    .describe('Use "add" para adicionar; "remove" para remover'),
  reason: z
    .string()
    .optional()
    .describe("Motivo breve da classificação (ex.: cliente pediu proposta)"),
});

export class ManageConversationLabelsTool implements AgentTool {
  name = "manage_conversation_tags";
  description =
    "Aplica ou remove tags na conversa conforme as regras do prompt da organização. " +
    "Use quando o cliente se encaixar em um critério de classificação de lead (ex.: interessado, quente, frio). " +
    "Tags devem existir previamente na organização.";
  inputSchema = inputSchema;

  constructor(private db: SupabaseClient) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Parâmetros inválidos." });
    }

    const result = await manageConversationLabels({
      db: this.db,
      orgId: String(ctx.orgId),
      conversationId: String(ctx.conversationId),
      labels: parsed.data.labels,
      action: parsed.data.action,
      logContext: {
        orgId: String(ctx.orgId),
        conversationId: String(ctx.conversationId),
        reason: parsed.data.reason ?? "agent_classification",
      },
    });

    if (!result.ok) {
      return Err({ code: "EXECUTION_FAILED", message: result.error });
    }

    const actionText =
      parsed.data.action === "remove"
        ? `Tags removidas: ${parsed.data.labels.join(", ")}.`
        : `Tags aplicadas: ${parsed.data.labels.join(", ")}.`;

    return Ok(
      `${actionText} Tags atuais da conversa: ${result.labels.join(", ") || "(nenhuma)"}. Continue o atendimento normalmente.`,
    );
  }
}
