import type { EventBus, DomainEvent } from "@/domain/ports";
import { assertInngestEventKeyConfigured, inngest } from "./inngest-client";

function eventIdempotencyId(event: DomainEvent): string | undefined {
  switch (event.type) {
    case "message.received":
      return `message.received:${event.payload.messageId}`;
    case "kb.document.uploaded":
      return `kb.document.uploaded:${event.payload.documentId}`;
    default:
      return undefined;
  }
}

export class InngestEventBus implements EventBus {
  async emit(event: DomainEvent): Promise<void> {
    assertInngestEventKeyConfigured();

    const id = eventIdempotencyId(event);
    await inngest.send({
      name: event.type,
      data: event.payload,
      ...(id ? { id } : {}),
    });
  }
}
