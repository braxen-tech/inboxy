import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { handoffConversationToHuman } from "@/application/services/conversation-handoff";

const inputSchema = z.object({
  reason: z
    .string()
    .optional()
    .describe("Motivo breve do pedido do cliente (ex.: pediu atendente humano)"),
});

export class TransferToHumanTool implements AgentTool {
  name = "transfer_to_human";
  description =
    "Transfere a conversa para um atendente humano no Chatwoot. Obrigatório quando o cliente pedir explicitamente por uma pessoa/atendente. Também use quando o prompt da organização definir outras situações de handoff.";
  inputSchema = inputSchema;

  constructor(private db: SupabaseClient) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    if (!ctx.chatwoot) {
      return Err({
        code: "EXECUTION_FAILED",
        message: "Chatwoot não configurado — transferência indisponível.",
      });
    }

    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Parâmetros inválidos." });
    }

    const handoff = await handoffConversationToHuman({
      db: this.db,
      orgId: String(ctx.orgId),
      conversationId: ctx.conversationId,
      chatwoot: {
        apiUrl: ctx.chatwoot.apiUrl,
        adminToken: ctx.chatwoot.apiToken,
        botToken: ctx.chatwoot.botAccessToken,
        accountId: ctx.chatwoot.accountId,
        conversationId: ctx.chatwoot.conversationId,
      },
      logContext: {
        orgId: String(ctx.orgId),
        conversationId: ctx.conversationId,
        reason: parsed.data.reason ?? "user_requested",
      },
    });

    if (!handoff.ok) {
      return Err({
        code: "EXECUTION_FAILED",
        message: "Não foi possível transferir para um atendente agora. Peça para o cliente tentar novamente em instantes.",
      });
    }

    return Ok(
      "Transferência concluída. A conversa está na fila de atendentes humanos (status open). " +
        "Confirme ao cliente de forma cordial que um atendente assumirá em breve e encerre sua participação — " +
        "não continue resolvendo o assunto como bot.",
    );
  }
}
