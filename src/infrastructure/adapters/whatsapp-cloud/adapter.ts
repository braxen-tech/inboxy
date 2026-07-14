import type {
  InboundAttachment,
  InboundMessage,
  MessagingChannel,
  SendError,
  SendParams,
  WebhookError,
  WebhookVerification,
} from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Err, Ok } from "@/domain/errors";
import { logger } from "@/lib/logger";
import { verifyChallengeToken, verifyMetaSignature } from "../meta/hmac";
import { graphPost } from "../meta/graph-client";

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

interface WhatsAppWebhookRoot {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<WhatsAppInboundMessage>;
      };
    }>;
  }>;
}

interface WhatsAppInboundMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
  audio?: { id?: string; mime_type?: string };
  video?: { id?: string; mime_type?: string; caption?: string };
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
  sticker?: { id?: string; mime_type?: string };
}

export class WhatsAppCloudAdapter implements MessagingChannel {
  readonly type = "whatsapp" as const;

  verifyWebhook(params: WebhookVerification, expectedToken: string): string | null {
    if (params.mode !== "subscribe") return null;
    if (!verifyChallengeToken(params.token, expectedToken)) return null;
    return params.challenge;
  }

  async parseWebhook(
    rawBody: string,
    signature: string | null,
    appSecret: string,
  ): Promise<Result<InboundMessage[], WebhookError>> {
    if (!verifyMetaSignature(rawBody, signature, appSecret)) {
      return Err({ code: "SECRET_INVALID", message: "Invalid X-Hub-Signature-256" });
    }

    let payload: WhatsAppWebhookRoot;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return Err({ code: "PARSE_FAILED", message: "Failed to parse webhook body" });
    }

    if (payload.object !== "whatsapp_business_account") {
      return Err({ code: "IGNORED_EVENT", message: `Ignored object: ${payload.object}` });
    }

    const out: InboundMessage[] = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        const value = change.value;
        if (!value?.messages?.length) continue;

        const phoneNumberId = value.metadata?.phone_number_id ?? null;
        const contactName = value.contacts?.[0]?.profile?.name ?? null;

        for (const m of value.messages) {
          if (!m.id || !m.from) continue;

          const { content, attachments, messageType } = extractContent(m);

          out.push({
            channelType: "whatsapp",
            externalMessageId: m.id,
            externalConversationId: m.from,
            senderName: contactName,
            senderPhone: m.from,
            senderEmail: null,
            senderExternalId: m.from,
            senderUsername: null,
            recipientPhoneNumberId: phoneNumberId,
            recipientIgUserId: null,
            content,
            attachments,
            timestamp: new Date(Number(m.timestamp ?? Date.now() / 1000) * 1000),
            // messageType tucked into a private symbol on the object is overkill; consumer reads via content+attachments
          });
          void messageType;
        }
      }
    }

    if (out.length === 0) {
      return Err({ code: "IGNORED_EVENT", message: "No user messages in payload" });
    }

    return Ok(out);
  }

  async send(params: SendParams): Promise<Result<string, SendError>> {
    // Handle attachments as separate messages (WhatsApp requires it).
    if (params.attachments?.length) {
      for (const att of params.attachments) {
        const attRes = await this.sendMedia(params, att.url, att.filename, att.contentType);
        if (!attRes.ok) return attRes;
      }
      if (!params.content) return Ok("attachments_sent");
    }

    return this.sendText(params);
  }

  private async sendText(params: SendParams): Promise<Result<string, SendError>> {
    let lastMsg = "";
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const res = await graphPost<{ messages?: Array<{ id: string }> }>(
        `/${params.fromExternalId}/messages`,
        params.accessToken,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: params.toExternalId,
          type: "text",
          text: { body: params.content, preview_url: false },
        },
      );

      if (res.ok) {
        const id = res.data.messages?.[0]?.id ?? "unknown";
        return Ok(id);
      }

      lastMsg = res.error.message;
      const status = res.error.status;

      if (status === 401) return Err({ code: "UNAUTHORIZED", message: lastMsg, httpStatus: 401 });
      if (status === 429) return Err({ code: "RATE_LIMITED", message: lastMsg, httpStatus: 429 });
      if (status === 400) return Err({ code: "INVALID_RECIPIENT", message: lastMsg, httpStatus: 400 });
      if (status >= 400 && status < 500) {
        return Err({ code: "API_ERROR", message: lastMsg, httpStatus: status });
      }

      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      logger.warn("WhatsApp send retry", { attempt, delay, message: lastMsg });
      await new Promise((r) => setTimeout(r, delay));
    }

    return Err({ code: "NETWORK_ERROR", message: `WhatsApp send failed: ${lastMsg}` });
  }

  private async sendMedia(
    params: SendParams,
    link: string,
    filename: string | undefined,
    contentType: string | undefined,
  ): Promise<Result<string, SendError>> {
    const type = mediaKindFromContentType(contentType);
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: params.toExternalId,
      type,
      [type]: filename ? { link, filename } : { link },
    };

    const res = await graphPost<{ messages?: Array<{ id: string }> }>(
      `/${params.fromExternalId}/messages`,
      params.accessToken,
      body,
    );

    if (res.ok) return Ok(res.data.messages?.[0]?.id ?? "media_sent");

    const status = res.error.status;
    if (status === 401) return Err({ code: "UNAUTHORIZED", message: res.error.message, httpStatus: 401 });
    if (status === 429) return Err({ code: "RATE_LIMITED", message: res.error.message, httpStatus: 429 });
    return Err({ code: "API_ERROR", message: res.error.message, httpStatus: status });
  }
}

function extractContent(m: WhatsAppInboundMessage): {
  content: string;
  attachments: InboundAttachment[];
  messageType: string;
} {
  switch (m.type) {
    case "text":
      return { content: m.text?.body ?? "", attachments: [], messageType: "text" };
    case "image":
      return {
        content: m.image?.caption ?? "",
        attachments: [{ mediaId: m.image?.id, contentType: m.image?.mime_type }],
        messageType: "image",
      };
    case "audio":
      return {
        content: "",
        attachments: [{ mediaId: m.audio?.id, contentType: m.audio?.mime_type }],
        messageType: "audio",
      };
    case "video":
      return {
        content: m.video?.caption ?? "",
        attachments: [{ mediaId: m.video?.id, contentType: m.video?.mime_type }],
        messageType: "video",
      };
    case "document":
      return {
        content: m.document?.caption ?? "",
        attachments: [
          {
            mediaId: m.document?.id,
            contentType: m.document?.mime_type,
            filename: m.document?.filename,
          },
        ],
        messageType: "document",
      };
    case "sticker":
      return {
        content: "",
        attachments: [{ mediaId: m.sticker?.id, contentType: m.sticker?.mime_type }],
        messageType: "sticker",
      };
    default:
      return { content: `[${m.type ?? "unknown"} message]`, attachments: [], messageType: "text" };
  }
}

function mediaKindFromContentType(ct: string | undefined): "image" | "audio" | "video" | "document" {
  if (!ct) return "document";
  if (ct.startsWith("image/")) return "image";
  if (ct.startsWith("audio/")) return "audio";
  if (ct.startsWith("video/")) return "video";
  return "document";
}
