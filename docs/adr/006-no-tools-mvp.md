# ADR-006: No Agent Tools in MVP

## Status
Accepted

## Context
The MVP focuses solely on contextual conversation. The agent replies based on the knowledge base and system prompt — it doesn't take actions (no scheduling, no lookups, no API calls).

## Decision
The `ToolRegistry` is implemented but contains zero registered tools. The agent loop still receives the registry and passes `tools=[]` to the AI model. This means:
- The AI model never attempts tool calls.
- The `maxSteps` / `stopWhen` logic is irrelevant — single-turn response.
- Risk of hallucinated actions is zero.

## How to add the first tool (e.g. scheduling)
1. Create `src/infrastructure/tools/schedule-appointment.ts` implementing `AgentTool`.
2. Register it in a bootstrap file.
3. Add `"schedule_appointment"` to an org's `tools_enabled` array.
4. The `ProcessMessageUseCase` already passes enabled tools to the agent runner.
5. Update the Claude adapter to pass tools and enable `stopWhen` for multi-step.

## Consequences
- Simpler debugging — bot only generates text.
- No risk of incorrect tool execution (e.g. wrong appointment).
- Clear upgrade path when tools are needed.
