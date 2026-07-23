import { getAppUrl } from "@/lib/app-url";

export function buildAgentBotWebhookUrl(secret: string): string {
  const base = getAppUrl().replace(/\/+$/, "");
  return `${base}/api/webhooks/chatwoot/agent-bot?secret=${encodeURIComponent(secret)}`;
}

export function buildAccountEventsWebhookUrl(secret: string): string {
  const base = getAppUrl().replace(/\/+$/, "");
  return `${base}/api/webhooks/chatwoot/account-events?secret=${encodeURIComponent(secret)}`;
}

/** Stable, business-facing Agent Bot display name in Chatwoot (not the org owner's personal name). */
export const INBOXY_AGENT_BOT_NAME = "Assistente Inboxy";

export const INBOXY_AGENT_BOT_DESCRIPTION =
  "Agente de IA Inboxy — atende automaticamente e faz handoff quando necessário";

/**
 * Resolves the Chatwoot Agent Bot display name.
 * Prefer a fixed product name so customer-facing chats never show a personal name.
 */
export function sanitizeAgentBotName(_orgName?: string): string {
  return INBOXY_AGENT_BOT_NAME;
}
