# ADR-001: Ports & Adapters Architecture

## Status
Accepted

## Context
This is a multi-tenant SaaS that will grow from a simple WhatsApp bot to a platform with scheduling, billing, multi-channel, voice, and RAG. We need an architecture that lets us add features as modules without rewriting the core message processing pipeline.

## Decision
Adopt a ports & adapters (hexagonal) architecture with four layers:
- **domain/** — entities, value objects, typed errors, port interfaces. Zero external dependencies.
- **application/** — use cases that orchestrate domain logic. Depends only on domain.
- **infrastructure/** — adapter implementations (WhatsApp, Claude, Supabase, Inngest, crypto). Implements domain ports.
- **app/** — Next.js routes and React components. Thin wiring layer.

## Consequences
- Adding a new channel (e.g. Chatwoot, Twilio, voice) = new adapter implementing `MessagingChannel`.
- Adding a new AI provider = new adapter implementing `AgentRunner`.
- Adding a new tool = new file in `infrastructure/tools/` implementing `AgentTool`.
- Slightly more boilerplate than a flat structure, but dramatically reduces coupling.
