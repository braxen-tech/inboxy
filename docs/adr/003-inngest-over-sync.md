# ADR-003: Inngest for Async Message Processing

## Status
Accepted

## Context
Chatwoot Agent Bot webhooks must respond quickly. Running Claude + tools can take 5–30 seconds, so processing cannot block the webhook response.

## Decision
Use Inngest as a durable event queue via the `EventBus` port (`InngestEventBus` adapter):
1. Webhook receives message → persists to DB → `EventBus.emit(message.received)` → responds 200 immediately.
2. Inngest worker picks up event → runs agent → sends reply via Chatwoot API.

Key configurations:
- `concurrency: 1 per conversationId` — prevents double replies when patient sends multiple messages quickly.
- `retries: 2` — automatic retry on transient failures.
- `onFailure` → inserts into `webhook_failures` table (DLQ) for manual replay.

## Consequences
- Webhook always responds in <1s.
- Message processing is resilient to transient failures.
- Inngest dashboard provides observability for free.
- One additional dependency (Inngest Cloud), but free tier covers MVP scale.
