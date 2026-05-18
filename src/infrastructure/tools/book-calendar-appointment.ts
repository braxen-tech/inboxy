import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { CalendarProvider } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";

const inputSchema = z.object({
  start: z.string().describe("Horário exato em formato ISO 8601 UTC (ex: 2025-01-10T12:00:00Z)"),
  attendeeName: z.string().min(2).describe("Nome completo do paciente"),
  attendeeEmail: z.email().describe("E-mail do paciente"),
});

export class BookCalendarAppointmentTool implements AgentTool {
  name = "book_calendar_appointment";
  description = "Agenda uma consulta no horário escolhido pelo paciente. Use somente após confirmar nome e e-mail.";
  inputSchema = inputSchema;

  constructor(private calendarProvider: CalendarProvider) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    if (!ctx.calendar) {
      return Err({ code: "EXECUTION_FAILED", message: "Agendamento não configurado para esta organização." });
    }

    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Informe start (ISO), attendeeName e attendeeEmail válidos." });
    }

    const { start, attendeeName, attendeeEmail } = parsed.data;
    const idempotencyKey = `${ctx.conversationId}:${start}`;

    const result = await this.calendarProvider.createBooking({
      eventTypeId: ctx.calendar.eventTypeId,
      start,
      attendeeName,
      attendeeEmail,
      attendeePhone: ctx.contactPhone,
      timeZone: ctx.calendar.timezone,
      apiToken: ctx.calendar.apiToken,
      idempotencyKey,
    });

    if (!result.ok) {
      if (result.error.code === "AUTH_EXPIRED") {
        return Err({ code: "EXECUTION_FAILED", message: "Credencial do calendário expirada. Entre em contato com a clínica." });
      }
      return Err({ code: "EXECUTION_FAILED", message: `Não foi possível agendar: ${result.error.message}` });
    }

    const booking = result.value;
    return Ok(
      `Consulta agendada com sucesso!\n` +
      `ID: ${booking.id}\n` +
      `Horário: ${booking.start}\n` +
      `Paciente: ${booking.attendeeName} (${booking.attendeeEmail})`
    );
  }
}
