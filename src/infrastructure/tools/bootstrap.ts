import type { CalendarProvider } from "@/domain/ports";
import { InMemoryToolRegistry } from "./registry";
import { CheckCalendarAvailabilityTool } from "./check-calendar-availability";
import { BookCalendarAppointmentTool } from "./book-calendar-appointment";

export function createToolRegistry(deps: { calendarProvider: CalendarProvider }): InMemoryToolRegistry {
  const registry = new InMemoryToolRegistry();
  registry.register(new CheckCalendarAvailabilityTool(deps.calendarProvider));
  registry.register(new BookCalendarAppointmentTool(deps.calendarProvider));
  return registry;
}
