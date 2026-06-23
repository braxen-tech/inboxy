import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { syncChatwootContact } from "@/application/services/chatwoot-contact-sync";

const inputSchema = z.object({
  name: z.string().optional().describe("Nome completo do contato"),
  email: z.string().optional().describe("E-mail do contato"),
  phone: z.string().optional().describe("Telefone do contato"),
  custom_attributes: z
    .record(z.string(), z.string())
    .optional()
    .describe("Atributos customizados definidos no Chatwoot (chave → valor)"),
  contact_labels: z
    .array(z.string().min(1))
    .optional()
    .describe('Tags de contato no Chatwoot (ex.: ["lead-qualificado"])'),
  label_action: z
    .enum(["add", "remove"])
    .default("add")
    .describe('Use "add" para adicionar tags; "remove" para remover tags existentes'),
  note: z
    .string()
    .optional()
    .describe(
      "Nota privada resumida para agentes humanos (interesse, budget, próximo passo). Visível só no Chatwoot.",
    ),
});

export class UpdateChatwootContactTool implements AgentTool {
  name = "update_chatwoot_contact";
  description =
    "Atualiza o contato no CRM do Chatwoot: dados (nome, e-mail, telefone), tags de contato e nota privada resumida. " +
    "Use quando o prompt da organização definir critérios de qualificação ou registro de lead (ex.: após coletar nome e e-mail). " +
    "Tags devem existir previamente no Chatwoot.";
  inputSchema = inputSchema;

  constructor(private db: SupabaseClient) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    if (!ctx.chatwoot) {
      return Err({
        code: "EXECUTION_FAILED",
        message: "Chatwoot não configurado — atualização de contato indisponível.",
      });
    }

    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Parâmetros inválidos." });
    }

    const result = await syncChatwootContact({
      apiUrl: ctx.chatwoot.apiUrl,
      apiToken: ctx.chatwoot.apiToken,
      accountId: ctx.chatwoot.accountId,
      conversationId: ctx.chatwoot.conversationId,
      contactId: ctx.chatwoot.contactId,
      localContactId: ctx.localContactId,
      db: this.db,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      customAttributes: parsed.data.custom_attributes,
      contactLabels: parsed.data.contact_labels,
      labelAction: parsed.data.label_action,
      note: parsed.data.note,
      logContext: {
        orgId: String(ctx.orgId),
        conversationId: ctx.conversationId,
      },
    });

    if (!result.ok) {
      return Err({
        code: "EXECUTION_FAILED",
        message: result.error,
      });
    }

    return Ok(`${result.summary} Continue o atendimento normalmente.`);
  }
}
