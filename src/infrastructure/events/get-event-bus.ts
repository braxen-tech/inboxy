import type { EventBus } from "@/domain/ports";
import { InngestEventBus } from "./inngest-event-bus";

let _bus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!_bus) {
    _bus = new InngestEventBus();
  }
  return _bus;
}

/** Test-only: reset singleton between test cases. */
export function resetEventBusForTests(): void {
  _bus = null;
}
