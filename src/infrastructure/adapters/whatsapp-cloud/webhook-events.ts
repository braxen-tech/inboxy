import type { InboundMessage } from "@/domain/ports";

interface WaContact {
  wa_id: string;
  profile?: { name?: string };
}

interface WaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string; filename?: string };
}

export interface WaWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        contacts?: WaContact[];
        messages?: WaMessage[];
        statuses?: unknown[];
      };
    }>;
  }>;
}

const MEDIA_LABELS: Record<string, string> = {
  image: "[imagem]",
  video: "[vídeo]",
  audio: "[áudio]",
  voice: "[áudio]",
  document: "[documento]",
  sticker: "[figurinha]",
  location: "[localização]",
  contacts: "[contato]",
};

function messageContent(msg: WaMessage): string | null {
  switch (msg.type) {
    case "text":
      return msg.text?.body ?? null;
    case "button":
      return msg.button?.text ?? null;
    case "interactive":
      return msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? null;
    default: {
      const label = MEDIA_LABELS[msg.type];
      if (!label) return null;
      const caption = msg.image?.caption ?? msg.video?.caption ?? msg.document?.caption;
      return caption ? `${label} ${caption}` : label;
    }
  }
}

/** Extracts inbound user messages; delivery/read status updates are ignored. */
export function parseWhatsAppCloudPayload(payload: WaWebhookPayload): InboundMessage[] {
  if (payload.object !== "whatsapp_business_account") return [];

  const out: InboundMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value?.messages) continue;
      const phoneNumberId = change.value.metadata?.phone_number_id ?? "";
      const names = new Map(
        (change.value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]),
      );

      for (const msg of change.value.messages) {
        const content = messageContent(msg)?.trim();
        if (!content) continue;
        out.push({
          channel: "whatsapp_cloud",
          externalMessageId: msg.id,
          externalConversationId: msg.from,
          senderExternalId: msg.from,
          senderName: names.get(msg.from) ?? null,
          senderPhone: `+${msg.from}`,
          senderEmail: null,
          content,
          timestamp: new Date(Number(msg.timestamp) * 1000),
          accountId: phoneNumberId,
        });
      }
    }
  }
  return out;
}
