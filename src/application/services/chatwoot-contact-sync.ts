import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ChatwootClient,
  type ChatwootAccountLabel,
  type ChatwootContactUpdatePayload,
} from "@/infrastructure/adapters/chatwoot/client";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";

const MAX_NOTE_LENGTH = 2000;

export interface SyncChatwootContactParams {
  apiUrl: string;
  apiToken: string;
  accountId: string;
  conversationId: number;
  /** Known Chatwoot contact ID from context or metadata */
  contactId?: number;
  /** Local Supabase contact row ID for dual-write */
  localContactId?: string;
  db?: SupabaseClient;
  name?: string;
  email?: string;
  phone?: string;
  customAttributes?: Record<string, string>;
  contactLabels?: string[];
  labelAction?: "add" | "remove";
  note?: string;
  logContext?: Record<string, string>;
}

function normalizeLabelTitle(title: string): string {
  return title.trim().toLowerCase();
}

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

async function resolveChatwootContactId(
  client: ChatwootClient,
  accountId: string,
  conversationId: number,
  contactId?: number,
): Promise<{ ok: true; contactId: number } | { ok: false; error: string }> {
  if (contactId != null) {
    return { ok: true, contactId };
  }

  const convResult = await client.getConversation(accountId, conversationId);
  if (!convResult.ok) {
    logger.warn("Failed to get Chatwoot conversation for contact ID", {
      conversationId: String(conversationId),
      error: convResult.error,
    });
    return {
      ok: false,
      error: "Não foi possível identificar o contato desta conversa no Chatwoot.",
    };
  }

  const senderId = convResult.data.meta?.sender?.id;
  if (senderId == null) {
    return {
      ok: false,
      error: "Contato não encontrado na conversa do Chatwoot.",
    };
  }

  return { ok: true, contactId: senderId };
}

export async function syncChatwootContact(
  params: SyncChatwootContactParams,
): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  const {
    apiUrl,
    apiToken,
    accountId,
    conversationId,
    contactId: knownContactId,
    localContactId,
    db,
    name,
    email,
    phone,
    customAttributes,
    contactLabels,
    labelAction = "add",
    note,
    logContext = {},
  } = params;

  const hasContactFields =
    !!name?.trim() ||
    !!email?.trim() ||
    !!phone?.trim() ||
    (customAttributes != null && Object.keys(customAttributes).length > 0);
  const hasLabels = contactLabels != null && contactLabels.length > 0;
  const hasNote = !!note?.trim();

  if (!hasContactFields && !hasLabels && !hasNote) {
    return { ok: false, error: "Nenhum dado informado para atualizar o contato." };
  }

  if (hasNote && note!.trim().length > MAX_NOTE_LENGTH) {
    return {
      ok: false,
      error: `A nota deve ter no máximo ${MAX_NOTE_LENGTH} caracteres.`,
    };
  }

  const client = new ChatwootClient(apiUrl, apiToken);

  const resolvedId = await resolveChatwootContactId(
    client,
    accountId,
    conversationId,
    knownContactId,
  );
  if (!resolvedId.ok) {
    return { ok: false, error: resolvedId.error };
  }

  const contactId = resolvedId.contactId;
  const actions: string[] = [];

  if (hasContactFields) {
    const payload: ChatwootContactUpdatePayload = {};
    if (name?.trim()) payload.name = name.trim();
    if (email?.trim()) payload.email = email.trim();
    if (phone?.trim()) payload.phone_number = phone.trim();
    if (customAttributes && Object.keys(customAttributes).length > 0) {
      payload.custom_attributes = customAttributes;
    }

    const updateResult = await client.updateContact(accountId, contactId, payload);
    if (!updateResult.ok) {
      logger.warn("Failed to update Chatwoot contact", {
        ...logContext,
        contactId: String(contactId),
        error: updateResult.error,
      });
      return {
        ok: false,
        error: "Não foi possível atualizar os dados do contato no Chatwoot.",
      };
    }
    actions.push("dados do contato atualizados");
  }

  if (hasLabels) {
    const accountLabelsResult = await client.listAccountLabels(accountId);
    if (!accountLabelsResult.ok) {
      return {
        ok: false,
        error: "Não foi possível validar as tags no Chatwoot agora.",
      };
    }

    const validation = validateRequestedLabels(contactLabels!, accountLabelsResult.data);
    if (!validation.ok) {
      const availableText =
        validation.available.length > 0
          ? validation.available.join(", ")
          : "nenhuma tag configurada na conta";
      return {
        ok: false,
        error:
          `Tag(s) inválida(s): ${validation.invalid.join(", ")}. ` +
          `Use apenas tags existentes no Chatwoot: ${availableText}.`,
      };
    }

    const currentResult = await client.getContactLabels(accountId, contactId);
    if (!currentResult.ok) {
      return {
        ok: false,
        error: "Não foi possível ler as tags atuais do contato.",
      };
    }

    const current = currentResult.data;
    const requested = validation.resolved;
    const nextLabels =
      labelAction === "remove"
        ? current.filter(
            (label) =>
              !requested.some((r) => normalizeLabelTitle(r) === normalizeLabelTitle(label)),
          )
        : [...new Set([...current, ...requested])];

    const setResult = await client.setContactLabels(accountId, contactId, nextLabels);
    if (!setResult.ok) {
      return {
        ok: false,
        error: "Não foi possível atualizar as tags do contato no Chatwoot.",
      };
    }
    actions.push(`tags do contato: ${setResult.data.join(", ") || "(nenhuma)"}`);
  }

  if (hasNote) {
    const noteResult = await client.sendPrivateNote(accountId, conversationId, note!.trim());
    if (!noteResult.ok) {
      logger.warn("Failed to post private note on Chatwoot conversation", {
        ...logContext,
        error: noteResult.error,
      });
      return {
        ok: false,
        error: "Não foi possível registrar a nota privada na conversa.",
      };
    }
    actions.push("nota privada registrada");
  }

  if (db && localContactId) {
    const { data: localContact } = await db
      .from("contacts")
      .select("metadata, name")
      .eq("id", localContactId)
      .maybeSingle();

    const existingMetadata =
      localContact?.metadata && typeof localContact.metadata === "object"
        ? (localContact.metadata as Record<string, unknown>)
        : {};

    const localUpdate: Record<string, unknown> = {
      metadata: {
        ...existingMetadata,
        chatwoot_contact_id: contactId,
        ...(email?.trim() ? { email: email.trim() } : {}),
        ...(customAttributes ?? {}),
      },
    };
    if (name?.trim()) {
      localUpdate.name = name.trim();
    }

    await db.from("contacts").update(localUpdate).eq("id", localContactId);
  }

  logger.info("Chatwoot contact synced", {
    ...logContext,
    contactId: String(contactId),
    actions: actions.join("; "),
  });
  captureServerEvent("chatwoot_contact_synced", {
    ...logContext,
    contact_id: String(contactId),
    actions: actions.join("; "),
  });

  const summary =
    actions.length > 0
      ? `Contato atualizado no Chatwoot: ${actions.join("; ")}.`
      : "Contato sincronizado no Chatwoot.";

  return { ok: true, summary };
}
