/**
 * CalendarProvider port — reserved for v1.1 (Cal.com integration).
 * Not implemented in MVP. Defined here for architectural reference.
 */

import type { Result } from "../errors";

export interface Slot {
  start: string;
  end: string;
}

export interface Booking {
  id: string;
  eventTypeId: string;
  start: string;
  attendeeName: string;
  attendeeEmail: string;
}

export type CalendarError = { code: "SLOTS_FAILED" | "BOOKING_FAILED" | "AUTH_EXPIRED"; message: string };

export interface ListSlotsParams {
  eventTypeId: string;
  startDate: string;
  endDate: string;
  apiToken: string;
}

export interface CreateBookingParams {
  eventTypeId: string;
  start: string;
  attendeeName: string;
  attendeeEmail: string;
  apiToken: string;
  idempotencyKey: string;
}

export interface CalendarProvider {
  listSlots(params: ListSlotsParams): Promise<Result<Slot[], CalendarError>>;
  createBooking(params: CreateBookingParams): Promise<Result<Booking, CalendarError>>;
}
