import { getAppUrl } from "@/lib/app-url";

export function buildAgentBotWebhookUrl(secret: string): string {
  const base = getAppUrl().replace(/\/+$/, "");
  return `${base}/api/webhooks/chatwoot/agent-bot?secret=${encodeURIComponent(secret)}`;
}

export function buildAccountEventsWebhookUrl(secret: string): string {
  const base = getAppUrl().replace(/\/+$/, "");
  return `${base}/api/webhooks/chatwoot/account-events?secret=${encodeURIComponent(secret)}`;
}

export function sanitizeAgentBotName(orgName: string): string {
  const trimmed = orgName.trim().slice(0, 80) || "Organização";
  return `${trimmed} - Inboxy`;
}
