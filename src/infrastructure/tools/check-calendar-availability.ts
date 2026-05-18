import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { CalendarProvider } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";

const MAX_RANGE_DAYS = 14;

const inputSchema = z.object({
  startDate: z.string().describe("Data inicial no formato YYYY-MM-DD"),
  endDate: z.string().describe("Data final no formato YYYY-MM-DD (máximo 14 dias a partir de startDate)"),
});

export class CheckCalendarAvailabilityTool implements AgentTool {
  name = "check_calendar_availability";
  description = "Consulta os horários disponíveis para agendamento no período especificado.";
  inputSchema = inputSchema;

  constructor(private calendarProvider: CalendarProvider) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    if (!ctx.calendar) {
      return Err({ code: "EXECUTION_FAILED", message: "Agendamento não configurado para esta organização." });
    }

    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Informe startDate e endDate no formato YYYY-MM-DD." });
    }

    const { startDate, endDate } = parsed.data;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 0 || diffDays > MAX_RANGE_DAYS) {
      return Err({ code: "VALIDATION_FAILED", message: `O período máximo é ${MAX_RANGE_DAYS} dias.` });
    }

    const result = await this.calendarProvider.listSlots({
      eventTypeId: ctx.calendar.eventTypeId,
      startDate,
      endDate,
      timeZone: ctx.calendar.timezone,
      apiToken: ctx.calendar.apiToken,
    });

    if (!result.ok) {
      if (result.error.code === "AUTH_EXPIRED") {
        return Err({ code: "EXECUTION_FAILED", message: "Credencial do calendário expirada. Entre em contato com a clínica." });
      }
      return Err({ code: "EXECUTION_FAILED", message: "Não foi possível consultar os horários disponíveis no momento." });
    }

    if (result.value.length === 0) {
      return Ok("Nenhum horário disponível no período solicitado.");
    }

    const grouped: Record<string, string[]> = {};
    for (const slot of result.value) {
      const date = slot.start.slice(0, 10);
      const time = slot.start.includes("T") ? slot.start.slice(11, 16) : slot.start;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(time);
    }

    const lines: string[] = ["Horários disponíveis:"];
    for (const [date, times] of Object.entries(grouped).sort()) {
      lines.push(`${date}: ${times.join(", ")}`);
    }

    return Ok(lines.join("\n"));
  }
}
