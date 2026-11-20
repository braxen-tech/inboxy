import { timingSafeEqual } from "node:crypto";
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
import { telegramMethodUrl } from "./client";
import { parseTelegramUpdate, type TgUpdate } from "./webhook-events";

function secretMatches(given: string | null, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

type TgBody = { ok?: boolean; description?: string; result?: { message_id?: number } };

function mapTelegramError(status: number, body: unknown): SendError {
  const message = (body as TgBody | null)?.description ?? `HTTP ${status}`;
  if (status === 401) return { code: "UNAUTHORIZED", message, httpStatus: status };
  if (status === 429) return { code: "RATE_LIMITED", message, httpStatus: status };
  return { code: "API_ERROR", message, httpStatus: status };
}

export class TelegramAdapter implements MessagingChannel {
  /** `secret` is the `secret_token` registered with setWebhook. */
  async parseWebhook(request: Request, secret: string): Promise<Result<InboundMessage[], WebhookError>> {
    if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), secret)) {
      return Err({ code: "SECRET_INVALID", message: "Invalid Telegram secret token" });
    }

    let update: TgUpdate;
    try {
      update = await request.json();
    } catch {
      return Err({ code: "PARSE_FAILED", message: "Failed to parse webhook body as JSON" });
    }

    const messages = parseTelegramUpdate(update);
    if (messages.length === 0) {
      return Err({ code: "IGNORED_EVENT", message: "No private text message" });
    }
    return Ok(messages);
  }

  async send(params: SendParams): Promise<Result<string, SendError>> {
    const { target } = params;
    if (target.kind !== "telegram") {
      return Err({ code: "API_ERROR", message: `TelegramAdapter cannot send to ${target.kind}` });
    }

    const post = async (method: string, payload: Record<string, unknown>): Promise<Result<string, SendError>> => {
      const res = await postJsonWithRetry(
        telegramMethodUrl(target.botToken, method),
        { chat_id: target.chatId, ...payload },
        {},
        "Telegram",
      );
      if (!res.ok) return res;
      const { status, body } = res.value;
      const parsed = body as TgBody | null;
      if (status >= 400 || !parsed?.ok) return Err(mapTelegramError(status, body));
      return Ok(String(parsed.result?.message_id ?? ""));
    };

    for (const att of params.attachments ?? []) {
      const result = isImageUrl(att.url)
        ? await post("sendPhoto", { photo: att.url })
        : await post("sendDocument", { document: att.url });
      if (!result.ok) {
        if (result.error.code === "RATE_LIMITED" || result.error.code === "UNAUTHORIZED") return result;
        logger.warn("Telegram attachment send failed, continuing", { url: att.url, error: result.error.message });
      }
    }

    if (!params.content) return Ok("attachments_sent");
    return post("sendMessage", { text: params.content });
  }
}
