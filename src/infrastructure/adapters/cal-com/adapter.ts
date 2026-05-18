import type {
  CalendarProvider,
  ListSlotsParams,
  CreateBookingParams,
  Slot,
  Booking,
  CalendarError,
} from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { CalComClient, type CalSlotsResponse, type CalBookingResponse } from "./client";
import { logger } from "@/lib/logger";

const SLOTS_API_VERSION = "2024-09-04";
const BOOKINGS_API_VERSION = "2024-08-13";

export class CalComAdapter implements CalendarProvider {
  async listSlots(params: ListSlotsParams): Promise<Result<Slot[], CalendarError>> {
    const client = new CalComClient({ apiToken: params.apiToken });

    // Ensure end date covers the full last day (add 1 day to endDate)
    const endPlusOne = new Date(params.endDate);
    endPlusOne.setDate(endPlusOne.getDate() + 1);
    const endDate = endPlusOne.toISOString().slice(0, 10);

    logger.info("Cal.com listSlots request", {
      eventTypeId: params.eventTypeId,
      start: params.startDate,
      end: endDate,
      timeZone: params.timeZone,
    });

    const result = await client.request<CalSlotsResponse>({
      method: "GET",
      path: "/v2/slots",
      apiVersion: SLOTS_API_VERSION,
      params: {
        eventTypeId: params.eventTypeId,
        start: params.startDate,
        end: endDate,
        timeZone: params.timeZone,
      },
    });

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        return Err({ code: "AUTH_EXPIRED", message: "Cal.com API key inválida ou expirada" });
      }
      logger.error("Cal.com listSlots failed", { status: result.status, message: result.message });
      return Err({ code: "SLOTS_FAILED", message: `Cal.com API error: ${result.status}` });
    }

    const slots: Slot[] = [];
    const data = result.data.data;

    logger.info("Cal.com listSlots response", {
      rawKeys: Object.keys(data),
      totalDays: Object.keys(data).length,
      data: JSON.stringify(data).slice(0, 500),
    });

    for (const [, daySlots] of Object.entries(data)) {
      for (const slot of daySlots) {
        if (typeof slot === "string") {
          slots.push({ start: slot, end: slot });
        } else if (typeof slot === "object" && slot !== null && "start" in slot) {
          // Cal.com v2 API returns { start: "ISO-string" }
          slots.push({ start: slot.start, end: slot.start });
        } else if (typeof slot === "object" && slot !== null && "time" in slot) {
          // Legacy format (might not be used)
          slots.push({ start: slot.time, end: slot.time });
        }
      }
    }

    logger.info("Cal.com slots parsed", { count: slots.length });

    return Ok(slots);
  }

  async createBooking(params: CreateBookingParams): Promise<Result<Booking, CalendarError>> {
    const client = new CalComClient({ apiToken: params.apiToken });

    const body: Record<string, unknown> = {
      eventTypeId: Number(params.eventTypeId),
      start: params.start,
      attendee: {
        name: params.attendeeName,
        email: params.attendeeEmail,
        timeZone: params.timeZone,
        language: "pt",
        ...(params.attendeePhone ? { phoneNumber: params.attendeePhone } : {}),
      },
      metadata: { idempotencyKey: params.idempotencyKey },
    };

    const result = await client.request<CalBookingResponse>({
      method: "POST",
      path: "/v2/bookings",
      apiVersion: BOOKINGS_API_VERSION,
      body,
    });

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        return Err({ code: "AUTH_EXPIRED", message: "Cal.com API key inválida ou expirada" });
      }
      logger.error("Cal.com createBooking failed", { status: result.status, message: result.message });
      return Err({ code: "BOOKING_FAILED", message: result.message || `Cal.com API error: ${result.status}` });
    }

    const booking = result.data.data;
    return Ok({
      id: String(booking.id),
      eventTypeId: String(booking.eventTypeId),
      start: booking.start,
      attendeeName: booking.attendees[0]?.name ?? params.attendeeName,
      attendeeEmail: booking.attendees[0]?.email ?? params.attendeeEmail,
    });
  }
}
