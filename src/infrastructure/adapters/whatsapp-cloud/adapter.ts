import type {
  InboundMessage,
  MessagingChannel,
  SendError,
  SendParams,
  WebhookError,
} from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { logger } from "@/lib/logger";
import { isImageUrl, postJsonWithRetry } from "../http-send";
import { GRAPH_BASE_URL, verifyMetaSignature } from "./client";
import { parseWhatsAppCloudPayload, type WaWebhookPayload } from "./webhook-events";

// Meta error codes that mean "slow down".
const RATE_LIMIT_CODES = new Set([4, 80007, 130429, 131048, 131056]);

type GraphError = { error?: { message?: string; code?: number } };

function mapGraphError(status: number, body: unknown): SendError {
  const err = (body as GraphError | null)?.error;
  const message = err?.message ?? `HTTP ${status}`;
  if (status === 401 || err?.code === 190) return { code: "UNAUTHORIZED", message, httpStatus: status };
  if (status === 429 || (err?.code != null && RATE_LIMIT_CODES.has(err.code))) {
    return { code: "RATE_LIMITED", message, httpStatus: status };
  }
  return { code: "API_ERROR", message, httpStatus: status };
}

export class WhatsAppCloudAdapter implements MessagingChannel {
  /** `secret` is the Meta app secret used to sign webhook payloads. */
  async parseWebhook(request: Request, secret: string): Promise<Result<InboundMessage[], WebhookError>> {
    const raw = await request.text();
    if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
      return Err({ code: "SECRET_INVALID", message: "Invalid Meta webhook signature" });
    }

    let payload: WaWebhookPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return Err({ code: "PARSE_FAILED", message: "Failed to parse webhook body as JSON" });
    }

    const messages = parseWhatsAppCloudPayload(payload);
    if (messages.length === 0) {
      return Err({ code: "IGNORED_EVENT", message: "No inbound user messages" });
    }
    return Ok(messages);
  }

  async send(params: SendParams): Promise<Result<string, SendError>> {
    const { target } = params;
    if (target.kind !== "whatsapp_cloud") {
      return Err({ code: "API_ERROR", message: `WhatsAppCloudAdapter cannot send to ${target.kind}` });
    }

    const url = `${GRAPH_BASE_URL}/${encodeURIComponent(target.phoneNumberId)}/messages`;
    const headers = { Authorization: `Bearer ${target.accessToken}` };
    const post = async (payload: Record<string, unknown>): Promise<Result<string, SendError>> => {
      const res = await postJsonWithRetry(
        url,
        { messaging_product: "whatsapp", recipient_type: "individual", to: target.to, ...payload },
        headers,
        "WhatsApp",
      );
      if (!res.ok) return res;
      const { status, body } = res.value;
      if (status >= 400) return Err(mapGraphError(status, body));
      const id = (body as { messages?: Array<{ id?: string }> } | null)?.messages?.[0]?.id;
      return id ? Ok(id) : Err({ code: "API_ERROR", message: "Missing message id in response" });
    };

    for (const att of params.attachments ?? []) {
      const result = isImageUrl(att.url)
        ? await post({ type: "image", image: { link: att.url } })
        : await post({ type: "document", document: { link: att.url, filename: att.filename } });
      if (!result.ok) {
        if (result.error.code === "RATE_LIMITED" || result.error.code === "UNAUTHORIZED") return result;
        logger.warn("WhatsApp attachment send failed, continuing", { url: att.url, error: result.error.message });
      }
    }

    if (!params.content) return Ok("attachments_sent");
    return post({ type: "text", text: { body: params.content, preview_url: true } });
  }
}
