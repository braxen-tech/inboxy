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

interface InstagramWebhookRoot {
  object?: string;
  entry?: Array<{
    id?: string; // IG business user id
    time?: number;
    messaging?: Array<InstagramMessagingEvent>;
  }>;
}

interface InstagramMessagingEvent {
  sender?: { id?: string; username?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: Array<{ type?: string; payload?: { url?: string } }>;
  };
}

export class InstagramDmAdapter implements MessagingChannel {
  readonly type = "instagram" as const;

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

    let payload: InstagramWebhookRoot;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return Err({ code: "PARSE_FAILED", message: "Failed to parse webhook body" });
    }

    if (payload.object !== "instagram") {
      return Err({ code: "IGNORED_EVENT", message: `Ignored object: ${payload.object}` });
    }

    const out: InboundMessage[] = [];

    for (const entry of payload.entry ?? []) {
      const igBusinessId = entry.id ?? null;
      for (const event of entry.messaging ?? []) {
        const m = event.message;
        if (!m || m.is_echo) continue;

        const senderId = event.sender?.id;
        if (!senderId) continue;

        const attachments: InboundAttachment[] = (m.attachments ?? [])
          .filter((a) => a.payload?.url)
          .map((a) => ({ url: a.payload!.url!, contentType: a.type }));

        out.push({
          channelType: "instagram",
          externalMessageId: m.mid ?? `${event.timestamp ?? Date.now()}-${senderId}`,
          externalConversationId: senderId,
          senderName: null,
          senderPhone: null,
          senderEmail: null,
          senderExternalId: senderId,
          senderUsername: event.sender?.username ?? null,
          recipientPhoneNumberId: null,
          recipientIgUserId: igBusinessId,
          content: m.text ?? (attachments.length ? "[media]" : ""),
          attachments,
          timestamp: new Date((event.timestamp ?? Date.now() / 1000) * 1000),
        });
      }
    }

    if (out.length === 0) {
      return Err({ code: "IGNORED_EVENT", message: "No user messages in payload" });
    }

    return Ok(out);
  }

  async send(params: SendParams): Promise<Result<string, SendError>> {
    // For Instagram, attachments go inline via the message.attachment field.
    if (params.attachments?.length) {
      for (const att of params.attachments) {
        const res = await this.postMessage(params, {
          attachment: {
            type: mediaKind(att.contentType),
            payload: { url: att.url, is_reusable: true },
          },
        });
        if (!res.ok) return res;
      }
      if (!params.content) return Ok("attachments_sent");
    }

    return this.postMessage(params, { text: params.content });
  }

  private async postMessage(
    params: SendParams,
    message: Record<string, unknown>,
  ): Promise<Result<string, SendError>> {
    let lastMsg = "";
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const res = await graphPost<{ message_id?: string; recipient_id?: string }>(
        `/${params.fromExternalId}/messages`,
        params.accessToken,
        {
          recipient: { id: params.toExternalId },
          message,
          messaging_type: "RESPONSE",
        },
      );

      if (res.ok) return Ok(res.data.message_id ?? "sent");

      lastMsg = res.error.message;
      const status = res.error.status;

      if (status === 401) return Err({ code: "UNAUTHORIZED", message: lastMsg, httpStatus: 401 });
      if (status === 429) return Err({ code: "RATE_LIMITED", message: lastMsg, httpStatus: 429 });
      if (status === 400) return Err({ code: "INVALID_RECIPIENT", message: lastMsg, httpStatus: 400 });
      if (status >= 400 && status < 500) return Err({ code: "API_ERROR", message: lastMsg, httpStatus: status });

      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      logger.warn("Instagram send retry", { attempt, delay, message: lastMsg });
      await new Promise((r) => setTimeout(r, delay));
    }

    return Err({ code: "NETWORK_ERROR", message: `Instagram send failed: ${lastMsg}` });
  }
}

function mediaKind(ct: string | undefined): "image" | "audio" | "video" | "file" {
  if (!ct) return "file";
  if (ct.startsWith("image")) return "image";
  if (ct.startsWith("audio")) return "audio";
  if (ct.startsWith("video")) return "video";
  return "file";
}
