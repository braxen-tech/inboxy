# ADR-007: Feature Roadmap — Plug-In Architecture

## Status
Accepted

## Context
The MVP is minimal in product surface but maximal in code extensibility. Each future feature plugs into an existing port/interface without modifying the core message processing pipeline.

## Roadmap

| Version | Feature | Integration Point |
|---------|---------|-------------------|
| **MVP** | Contextual conversation | Core `ProcessMessageUseCase` + `ClaudeAdapter` |
| **v1.1** | Cal.com scheduling | `CalendarProvider` port + `ScheduleAppointmentTool` |
| **v1.2** | Inbox + human handoff | `conversations.status` + pause agent when `status=human` |
| **v1.3** | Stripe billing | `BillingProvider` port + plan gating in use case |
| **v1.4** | RAG (large KB) | `KnowledgeRetriever` port + `LookupKnowledgeTool` |
| **v1.5** | PDF/DOCX upload | Supabase Storage + ingest job + RAG pipeline |
| **v1.6** | WhatsApp HSM templates | `MessagingChannel.sendTemplate()` extension |
| **v1.7** | Multi-channel | New `MessagingChannel` adapter (Chatwoot, Twilio, etc.) |
| **v2** | ElevenLabs voice | `VoiceChannel` port or voice adapter |

## Decision
Each version's work is isolated to:
1. Implementing an adapter or tool (new files).
2. Registering it in the bootstrap/DI.
3. Adding UI in the dashboard for configuration.

The core (`ProcessMessageUseCase`, webhook handler, Inngest pipeline) remains unchanged.

## Consequences
- Developers can work on features in parallel without merge conflicts in core files.
- Each feature can be feature-flagged per organization via `tools_enabled`.
- Rollback of any feature = remove from registry, no code changes in core.
