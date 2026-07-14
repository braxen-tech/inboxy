import type {
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
import { telegramSendMessage } from "./client";

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

interface TelegramChat {
  id?: number;
  type?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramFrom {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_bot?: boolean;
}

interface TelegramMessage {
  message_id?: number;
  date?: number;
  text?: string;
  caption?: string;
  chat?: TelegramChat;
  from?: TelegramFrom;
}

interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

/**
 * Telegram Bot API adapter (text DMs only for MVP).
 * Webhook auth is done at the route via X-Telegram-Bot-Api-Secret-Token;
 * verifyWebhook is unused for Telegram (returns null).
 */
export class TelegramBotAdapter implements MessagingChannel {
  readonly type = "telegram" as const;

  verifyWebhook(_params: WebhookVerification, _expectedToken: string): string | null {
    return null;
  }

  async parseWebhook(
    rawBody: string,
    _signature: string | null,
    _appSecret: string,
  ): Promise<Result<InboundMessage[], WebhookError>> {
    let update: TelegramUpdate;
    try {
      update = JSON.parse(rawBody) as TelegramUpdate;
    } catch {
      return Err({ code: "PARSE_FAILED", message: "Failed to parse Telegram update" });
    }

    const message = update.message ?? update.edited_message;
    if (!message) {
      return Err({ code: "IGNORED_EVENT", message: "No message in update" });
    }

    const chat = message.chat;
    const from = message.from;
    if (!chat?.id || chat.type !== "private") {
      return Err({ code: "IGNORED_EVENT", message: "Only private chats are supported" });
    }
    if (!from?.id || from.is_bot) {
      return Err({ code: "IGNORED_EVENT", message: "Missing or bot sender" });
    }

    const text = (message.text ?? message.caption ?? "").trim();
    if (!text) {
      return Err({ code: "IGNORED_EVENT", message: "Non-text message ignored (MVP)" });
    }

    const displayName =
      [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || null;

    const out: InboundMessage = {
      channelType: "telegram",
      externalMessageId: String(message.message_id ?? update.update_id ?? Date.now()),
      externalConversationId: String(chat.id),
      senderName: displayName,
      senderPhone: null,
      senderEmail: null,
      senderExternalId: String(from.id),
      senderUsername: from.username ?? null,
      recipientPhoneNumberId: null,
      recipientIgUserId: null,
      recipientTelegramBotId: null,
      content: text,
      attachments: [],
      timestamp: new Date((message.date ?? Date.now() / 1000) * 1000),
    };

    return Ok([out]);
  }

  async send(params: SendParams): Promise<Result<string, SendError>> {
    if (!params.content?.trim()) {
      return Err({ code: "API_ERROR", message: "Empty Telegram message" });
    }

    let lastMsg = "";
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const res = await telegramSendMessage(params.accessToken, params.toExternalId, params.content);
      if (res.ok) {
        return Ok(String(res.data.message_id));
      }

      lastMsg = res.error.message;
      const status = res.error.status;

      if (status === 401 || status === 403) {
        return Err({ code: "UNAUTHORIZED", message: lastMsg, httpStatus: status });
      }
      if (status === 429) {
        return Err({ code: "RATE_LIMITED", message: lastMsg, httpStatus: 429 });
      }
      if (status === 400) {
        return Err({ code: "INVALID_RECIPIENT", message: lastMsg, httpStatus: 400 });
      }
      if (status >= 400 && status < 500) {
        return Err({ code: "API_ERROR", message: lastMsg, httpStatus: status });
      }

      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      logger.warn("Telegram send retry", { attempt, delay, message: lastMsg });
      await new Promise((r) => setTimeout(r, delay));
    }

    return Err({ code: "NETWORK_ERROR", message: `Telegram send failed: ${lastMsg}` });
  }
}
