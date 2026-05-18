import { describe, it, expect, vi } from "vitest";
import { CheckCalendarAvailabilityTool } from "@/infrastructure/tools/check-calendar-availability";
import { BookCalendarAppointmentTool } from "@/infrastructure/tools/book-calendar-appointment";
import { Ok, Err } from "@/domain/errors";
import type { CalendarProvider, ToolContext } from "@/domain/ports";
import type { OrgId } from "@/domain/value-objects";

function makeCtx(overrides?: Partial<ToolContext>): ToolContext {
  return {
    orgId: "org-1" as OrgId,
    contactPhone: "+5511999999999",
    conversationId: "conv-1",
    calendar: {
      eventTypeId: "123",
      apiToken: "cal_test",
      timezone: "America/Sao_Paulo",
      bookingUrl: "https://cal.com/clinica/consulta",
    },
    ...overrides,
  };
}

function makeMockProvider(): CalendarProvider {
  return {
    listSlots: vi.fn(),
    createBooking: vi.fn(),
  };
}

describe("CheckCalendarAvailabilityTool", () => {
  it("returns error when calendar context is missing", async () => {
    const provider = makeMockProvider();
    const tool = new CheckCalendarAvailabilityTool(provider);
    const ctx = makeCtx({ calendar: undefined });

    const result = await tool.execute(ctx, { startDate: "2025-01-10", endDate: "2025-01-12" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("EXECUTION_FAILED");
  });

  it("validates date range exceeding 14 days", async () => {
    const provider = makeMockProvider();
    const tool = new CheckCalendarAvailabilityTool(provider);
    const ctx = makeCtx();

    const result = await tool.execute(ctx, { startDate: "2025-01-01", endDate: "2025-01-20" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_FAILED");
  });

  it("returns formatted slots on success", async () => {
    const provider = makeMockProvider();
    (provider.listSlots as ReturnType<typeof vi.fn>).mockResolvedValue(
      Ok([
        { start: "2025-01-10T09:00", end: "2025-01-10T09:30" },
        { start: "2025-01-10T10:00", end: "2025-01-10T10:30" },
      ]),
    );
    const tool = new CheckCalendarAvailabilityTool(provider);
    const ctx = makeCtx();

    const result = await tool.execute(ctx, { startDate: "2025-01-10", endDate: "2025-01-12" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("09:00");
      expect(result.value).toContain("10:00");
    }
  });

  it("returns message when no slots", async () => {
    const provider = makeMockProvider();
    (provider.listSlots as ReturnType<typeof vi.fn>).mockResolvedValue(Ok([]));
    const tool = new CheckCalendarAvailabilityTool(provider);
    const ctx = makeCtx();

    const result = await tool.execute(ctx, { startDate: "2025-01-10", endDate: "2025-01-12" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain("Nenhum horário");
  });
});

describe("BookCalendarAppointmentTool", () => {
  it("returns error when calendar context is missing", async () => {
    const provider = makeMockProvider();
    const tool = new BookCalendarAppointmentTool(provider);
    const ctx = makeCtx({ calendar: undefined });

    const result = await tool.execute(ctx, {
      start: "2025-01-10T09:00:00Z",
      attendeeName: "João",
      attendeeEmail: "joao@test.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("EXECUTION_FAILED");
  });

  it("validates input schema", async () => {
    const provider = makeMockProvider();
    const tool = new BookCalendarAppointmentTool(provider);
    const ctx = makeCtx();

    const result = await tool.execute(ctx, { start: "2025-01-10T09:00:00Z", attendeeName: "J" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_FAILED");
  });

  it("returns booking confirmation on success", async () => {
    const provider = makeMockProvider();
    (provider.createBooking as ReturnType<typeof vi.fn>).mockResolvedValue(
      Ok({
        id: "456",
        eventTypeId: "123",
        start: "2025-01-10T09:00:00Z",
        attendeeName: "João Silva",
        attendeeEmail: "joao@test.com",
      }),
    );
    const tool = new BookCalendarAppointmentTool(provider);
    const ctx = makeCtx();

    const result = await tool.execute(ctx, {
      start: "2025-01-10T09:00:00Z",
      attendeeName: "João Silva",
      attendeeEmail: "joao@test.com",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("agendada com sucesso");
      expect(result.value).toContain("João Silva");
    }

    expect(provider.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        attendeePhone: "+5511999999999",
        idempotencyKey: "conv-1:2025-01-10T09:00:00Z",
      }),
    );
  });

  it("returns friendly error on booking failure", async () => {
    const provider = makeMockProvider();
    (provider.createBooking as ReturnType<typeof vi.fn>).mockResolvedValue(
      Err({ code: "BOOKING_FAILED", message: "Slot not available" }),
    );
    const tool = new BookCalendarAppointmentTool(provider);
    const ctx = makeCtx();

    const result = await tool.execute(ctx, {
      start: "2025-01-10T09:00:00Z",
      attendeeName: "João Silva",
      attendeeEmail: "joao@test.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EXECUTION_FAILED");
      expect(result.error.message).toContain("Slot not available");
    }
  });
});
