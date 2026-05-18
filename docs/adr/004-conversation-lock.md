# ADR-004: Conversation Lock to Prevent Double Replies

## Status
Accepted

## Context
A patient might send 3 messages in quick succession. Without protection, 3 Inngest events fire and 3 workers try to run the agent simultaneously for the same conversation, producing 3 separate replies.

## Decision
Two-layer protection:
1. **Inngest concurrency limit**: `concurrency: [{ key: "event.data.conversationId", limit: 1 }]` — only one worker processes a conversation at a time. Others wait in queue.
2. **DB-level lock**: `conversations.processing_lock_until` column. Worker sets it to `now() + 60s` before processing, clears it after. If a stale lock exists (worker crashed), it expires naturally.

## Consequences
- Only one coherent reply per burst of patient messages.
- Small latency increase for rapid-fire messages (queued, not dropped).
- Self-healing: stale locks expire after 60s.
