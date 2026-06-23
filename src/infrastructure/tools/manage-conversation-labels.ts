import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { manageConversationLabels } from "@/application/services/conversation-labels";

const inputSchema = z.object({
  labels: z
    .array(z.string().min(1))
    .min(1)
    .describe('Labels a aplicar ou remover (ex.: ["quente", "interessado"])'),
  action: z
    .enum(["add", "remove"])
    .default("add")
    .describe('Use "add" para adicionar labels; "remove" para remover labels existentes'),
  reason: z
    .string()
    .optional()
    .describe("Motivo breve da classificação (ex.: cliente pediu proposta)"),
});

export class ManageConversationLabelsTool implements AgentTool {
  name = "manage_conversation_labels";
  description =
    "Aplica ou remove labels na conversa do Chatwoot conforme as regras do prompt da organização. " +
    "Use quando o cliente se encaixar em um critério de classificação de lead (ex.: interessado, quente, frio). " +
    "Labels devem existir previamente no Chatwoot.";
  inputSchema = inputSchema;

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    if (!ctx.chatwoot) {
      return Err({
        code: "EXECUTION_FAILED",
        message: "Chatwoot não configurado — labels indisponíveis.",
      });
    }

    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Parâmetros inválidos." });
    }

    const result = await manageConversationLabels({
      apiUrl: ctx.chatwoot.apiUrl,
      apiToken: ctx.chatwoot.apiToken,
      accountId: ctx.chatwoot.accountId,
      conversationId: ctx.chatwoot.conversationId,
      labels: parsed.data.labels,
      action: parsed.data.action,
      logContext: {
        orgId: String(ctx.orgId),
        conversationId: ctx.conversationId,
        reason: parsed.data.reason ?? "agent_classification",
      },
    });

    if (!result.ok) {
      return Err({
        code: "EXECUTION_FAILED",
        message: result.error,
      });
    }

    const actionText =
      parsed.data.action === "remove"
        ? `Labels removidas: ${parsed.data.labels.join(", ")}.`
        : `Labels aplicadas: ${parsed.data.labels.join(", ")}.`;

    return Ok(
      `${actionText} Labels atuais da conversa: ${result.labels.join(", ") || "(nenhuma)"}. ` +
        "Continue o atendimento normalmente.",
    );
  }
}
