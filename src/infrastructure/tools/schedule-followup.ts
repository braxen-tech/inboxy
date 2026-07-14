import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { isAllowedFollowupIdleMinutes } from "@/lib/followup-idle-options";

const inputSchema = z
  .object({
    delay_minutes: z
      .number()
      .int()
      .optional()
      .describe(
        "Minutos até o follow-up (30, 40, 50, 60, 120… até 720). Use quando o cliente pedir para voltar daqui a X tempo.",
      ),
    scheduled_at: z
      .string()
      .optional()
      .describe("ISO 8601 para horário exato do follow-up (alternativa a delay_minutes)."),
    reason: z
      .string()
      .min(1)
      .describe("Contexto breve para gerar a mensagem de retomada (ex.: cliente pediu retorno amanhã)."),
  })
  .refine((data) => data.delay_minutes != null || data.scheduled_at != null, {
    message: "Informe delay_minutes ou scheduled_at.",
  });

export class ScheduleFollowupTool implements AgentTool {
  name = "schedule_followup";
  description =
    "Agenda um follow-up automático para retomar a conversa depois. " +
    "Use quando o cliente pedir para voltar depois, disser que vai pensar, ou combinar um horário para retorno. " +
    "Não use para reengajamento imediato — o sistema já faz isso automaticamente quando configurado.";
  inputSchema = inputSchema;

  constructor(private db: SupabaseClient) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Parâmetros inválidos para agendar follow-up." });
    }

    let scheduledAt: Date;
    if (parsed.data.scheduled_at) {
      scheduledAt = new Date(parsed.data.scheduled_at);
      if (Number.isNaN(scheduledAt.getTime())) {
        return Err({ code: "VALIDATION_FAILED", message: "scheduled_at inválido." });
      }
    } else {
      const delayMinutes = parsed.data.delay_minutes!;
      if (!isAllowedFollowupIdleMinutes(delayMinutes)) {
        return Err({
          code: "VALIDATION_FAILED",
          message: "delay_minutes deve ser um dos valores permitidos (30 min a 12 h).",
        });
      }
      scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    }

    if (scheduledAt.getTime() <= Date.now()) {
      return Err({ code: "VALIDATION_FAILED", message: "O follow-up deve ser agendado no futuro." });
    }

    const { data: conversation } = await this.db
      .from("conversations")
      .select("last_inbound_at, status")
      .eq("id", String(ctx.conversationId))
      .maybeSingle();

    if (!conversation) {
      return Err({ code: "EXECUTION_FAILED", message: "Conversação não encontrada." });
    }

    if (conversation.last_inbound_at) {
      const maxAt = new Date(conversation.last_inbound_at).getTime() + 24 * 60 * 60 * 1000;
      if (scheduledAt.getTime() > maxAt) {
        return Err({
          code: "EXECUTION_FAILED",
          message:
            "Follow-up deve ocorrer dentro de 24h da última mensagem do cliente (limite do WhatsApp). " +
            "Sugira um horário mais próximo ou peça que o cliente retorne depois.",
        });
      }
    }

    const { data: existing } = await this.db
      .from("scheduled_followups")
      .select("id")
      .eq("conversation_id", String(ctx.conversationId))
      .eq("type", "manual")
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      await this.db
        .from("scheduled_followups")
        .update({
          scheduled_at: scheduledAt.toISOString(),
          metadata: { reason: parsed.data.reason },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      const { error } = await this.db.from("scheduled_followups").insert({
        organization_id: String(ctx.orgId),
        conversation_id: String(ctx.conversationId),
        type: "manual",
        scheduled_at: scheduledAt.toISOString(),
        status: "pending",
        metadata: { reason: parsed.data.reason },
      });

      if (error) {
        return Err({
          code: "EXECUTION_FAILED",
          message: "Não foi possível agendar o follow-up agora.",
        });
      }
    }

    const formatted = scheduledAt.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    });

    return Ok(
      `Follow-up agendado para ${formatted}. Confirme ao cliente de forma cordial e encerre sua participação por ora.`,
    );
  }
}
