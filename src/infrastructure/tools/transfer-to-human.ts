import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { handoffConversationToHuman } from "@/application/services/conversation-handoff";
import {
  fetchAccountAgents,
  resolveAgentByName,
} from "@/application/services/conversation-assignment";

const inputSchema = z.object({
  reason: z
    .string()
    .optional()
    .describe("Motivo breve do pedido do cliente (ex.: pediu atendente humano)"),
  assignee_name: z
    .string()
    .optional()
    .describe(
      'Nome do atendente humano no Chatwoot quando o prompt definir roteamento (ex.: "Ana Silva"). Omita para fila geral.',
    ),
});

export class TransferToHumanTool implements AgentTool {
  name = "transfer_to_human";
  description =
    "Transfere a conversa para um atendente humano no Chatwoot. Obrigatório quando o cliente pedir explicitamente por uma pessoa/atendente. " +
    "Também use quando o prompt da organização definir outras situações de handoff ou roteamento para um atendente específico (assignee_name).";
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

    let assigneeId: number | undefined;
    let assigneeName: string | undefined;

    if (parsed.data.assignee_name?.trim()) {
      const agents = await fetchAccountAgents({
        apiUrl: ctx.chatwoot.apiUrl,
        apiToken: ctx.chatwoot.apiToken,
        accountId: ctx.chatwoot.accountId,
      });
      const resolved = resolveAgentByName(parsed.data.assignee_name, agents);
      if (!resolved.ok) {
        return Err({
          code: "EXECUTION_FAILED",
          message: resolved.error,
        });
      }
      assigneeId = resolved.agent.id;
      assigneeName = resolved.agent.name;
    }

    const handoff = await handoffConversationToHuman({
      db: this.db,
      orgId: String(ctx.orgId),
      conversationId: ctx.conversationId,
      assigneeId,
      assigneeName,
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
        assigneeName: assigneeName ?? "",
      },
    });

    if (!handoff.ok) {
      return Err({
        code: "EXECUTION_FAILED",
        message: "Não foi possível transferir para um atendente agora. Peça para o cliente tentar novamente em instantes.",
      });
    }

    if (assigneeName) {
      return Ok(
        `Transferência concluída. A conversa foi atribuída a ${assigneeName} (status open). ` +
          "Confirme ao cliente de forma cordial que esse atendente assumirá em breve e encerre sua participação — " +
          "não continue resolvendo o assunto como bot.",
      );
    }

    return Ok(
      "Transferência concluída. A conversa está na fila de atendentes humanos (status open). " +
        "Confirme ao cliente de forma cordial que um atendente assumirá em breve e encerre sua participação — " +
        "não continue resolvendo o assunto como bot.",
    );
  }
}
