import {
  ChatwootClient,
  type ChatwootAccountLabel,
} from "@/infrastructure/adapters/chatwoot/client";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";

export interface ManageConversationLabelsParams {
  apiUrl: string;
  apiToken: string;
  accountId: string;
  conversationId: number;
  labels: string[];
  action: "add" | "remove";
  logContext?: Record<string, string>;
}

function normalizeLabelTitle(title: string): string {
  return title.trim().toLowerCase();
}

const CONFLICTING_LABELS: Record<string, string[]> = {
  quente: ["frio"],
  frio: ["quente"],
  interessado: [],
};

function resolveAccountLabelTitles(labels: ChatwootAccountLabel[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const label of labels) {
    if (typeof label.title === "string" && label.title.trim()) {
      map.set(normalizeLabelTitle(label.title), label.title);
    }
  }
  return map;
}

function validateRequestedLabels(
  requested: string[],
  accountLabels: ChatwootAccountLabel[],
): { ok: true; resolved: string[] } | { ok: false; invalid: string[]; available: string[] } {
  const byNormalized = resolveAccountLabelTitles(accountLabels);
  const available = [...byNormalized.values()].sort((a, b) => a.localeCompare(b));
  const resolved: string[] = [];
  const invalid: string[] = [];

  for (const label of requested) {
    const canonical = byNormalized.get(normalizeLabelTitle(label));
    if (canonical) {
      if (!resolved.includes(canonical)) resolved.push(canonical);
    } else {
      invalid.push(label);
    }
  }

  if (invalid.length > 0) {
    return { ok: false, invalid, available };
  }

  return { ok: true, resolved };
}

function removeConflictingLabels(
  currentLabels: string[],
  newLabels: string[],
): string[] {
  let result = currentLabels;

  for (const newLabel of newLabels) {
    const normalized = normalizeLabelTitle(newLabel);
    const conflicts = CONFLICTING_LABELS[normalized] || [];

    result = result.filter((label) => {
      const labelNormalized = normalizeLabelTitle(label);
      return !conflicts.some((c) => normalizeLabelTitle(c) === labelNormalized);
    });
  }

  return result;
}

export async function manageConversationLabels(
  params: ManageConversationLabelsParams,
): Promise<{ ok: true; labels: string[] } | { ok: false; error: string }> {
  const {
    apiUrl,
    apiToken,
    accountId,
    conversationId,
    labels,
    action,
    logContext = {},
  } = params;

  if (labels.length === 0) {
    return { ok: false, error: "Nenhuma label informada." };
  }

  const client = new ChatwootClient(apiUrl, apiToken);

  const accountLabelsResult = await client.listAccountLabels(accountId);
  if (!accountLabelsResult.ok) {
    logger.warn("Failed to list Chatwoot account labels", {
      ...logContext,
      error: accountLabelsResult.error,
    });
    return {
      ok: false,
      error: "Não foi possível validar as labels no Chatwoot agora.",
    };
  }

  const validation = validateRequestedLabels(labels, accountLabelsResult.data);
  if (!validation.ok) {
    const availableText =
      validation.available.length > 0
        ? validation.available.join(", ")
        : "nenhuma label configurada na conta";
    return {
      ok: false,
      error:
        `Label(s) inválida(s): ${validation.invalid.join(", ")}. ` +
        `Use apenas labels existentes no Chatwoot: ${availableText}.`,
    };
  }

  const currentResult = await client.getConversationLabels(accountId, conversationId);
  if (!currentResult.ok) {
    logger.warn("Failed to get Chatwoot conversation labels", {
      ...logContext,
      error: currentResult.error,
    });
    return {
      ok: false,
      error: "Não foi possível ler as labels atuais da conversa.",
    };
  }

  const current = currentResult.data;
  const requested = validation.resolved;

  const nextLabels =
    action === "remove"
      ? current.filter(
          (label) => !requested.some((r) => normalizeLabelTitle(r) === normalizeLabelTitle(label)),
        )
      : [...new Set([...removeConflictingLabels(current, requested), ...requested])];

  const setResult = await client.setConversationLabels(accountId, conversationId, nextLabels);
  if (!setResult.ok) {
    logger.warn("Failed to set Chatwoot conversation labels", {
      ...logContext,
      error: setResult.error,
    });
    return {
      ok: false,
      error: "Não foi possível atualizar as labels da conversa no Chatwoot.",
    };
  }

  logger.info("Conversation labels updated", {
    ...logContext,
    action,
    labels: requested.join(", "),
  });
  captureServerEvent("conversation_label_applied", {
    ...logContext,
    action,
    labels: requested.join(", "),
  });

  return { ok: true, labels: setResult.data };
}

export async function fetchAccountLabelTitles(params: {
  apiUrl: string;
  apiToken: string;
  accountId: string;
}): Promise<string[]> {
  const client = new ChatwootClient(params.apiUrl, params.apiToken);
  const result = await client.listAccountLabels(params.accountId);
  if (!result.ok) return [];
  return [...resolveAccountLabelTitles(result.data).values()].sort((a, b) =>
    a.localeCompare(b),
  );
}
