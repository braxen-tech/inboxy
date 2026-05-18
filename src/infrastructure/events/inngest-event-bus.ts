import type { EventBus, DomainEvent } from "@/domain/ports";
import { inngest } from "./inngest-client";

export class InngestEventBus implements EventBus {
  async emit(event: DomainEvent): Promise<void> {
    await inngest.send({
      name: event.type,
      data: event.payload,
    });
  }
}
