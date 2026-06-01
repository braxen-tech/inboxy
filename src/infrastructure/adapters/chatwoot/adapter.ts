import type { MessagingChannel, InboundMessage, SendParams, SendError, WebhookError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { ChatwootClient } from "./client";
import { logger } from "@/lib/logger";

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

interface ChatwootWebhookPayload {
  event: string;
  id: number;
  content: string | null;
  content_type: string;
  message_type: "incoming" | "outgoing";
  created_at: string;
  private: boolean;
  sender: {
    id: number;
    name: string | null;
    email: string | null;
    phone_number: string | null;
    type?: "contact" | "user";
  };
  conversation: {
    id: number;
    inbox_id: number;
    status: string;
  };
  account: {
    id: number;
    name: string;
  };
}

export class ChatwootAdapter implements MessagingChannel {
  async parseWebhook(request: Request, secret: string): Promise<Result<InboundMessage[], WebhookError>> {
    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret");

    if (querySecret !== secret) {
      return Err({ code: "SECRET_INVALID", message: "Invalid webhook secret" });
    }

    let payload: ChatwootWebhookPayload;
    try {
      payload = await request.json();
    } catch {
      return Err({ code: "PARSE_FAILED", message: "Failed to parse webhook body as JSON" });
    }

    if (payload.event !== "message_created") {
      return Err({ code: "IGNORED_EVENT", message: `Ignored event: ${payload.event}` });
    }

    if (payload.message_type !== "incoming") {
      return Err({ code: "IGNORED_EVENT", message: "Ignored: not an incoming message" });
    }

    if (payload.private) {
      return Err({ code: "IGNORED_EVENT", message: "Ignored: private note" });
    }

    if (!payload.content || payload.content.trim().length === 0) {
      return Err({ code: "IGNORED_EVENT", message: "Ignored: empty content" });
    }

    const message: InboundMessage = {
      externalMessageId: String(payload.id),
      chatwootConversationId: payload.conversation.id,
      senderName: payload.sender.name ?? null,
      senderPhone: payload.sender.phone_number ?? null,
      senderEmail: payload.sender.email ?? null,
      content: payload.content,
      timestamp: new Date(payload.created_at),
      accountId: String(payload.account.id),
    };

    return Ok([message]);
  }

  async send(params: SendParams): Promise<Result<string, SendError>> {
    const client = new ChatwootClient(params.apiUrl, params.apiToken);

    if (params.attachments?.length) {
      for (const att of params.attachments) {
        const result = await client.sendMessageWithAttachment(
          params.accountId,
          params.conversationId,
          "",
          att.url,
          att.filename,
        );
        if (!result.ok) {
          if (result.status === 429) {
            return Err({ code: "RATE_LIMITED", message: result.error });
          }
          logger.warn("Attachment send failed, continuing", { url: att.url, error: result.error });
        }
      }

      if (!params.content) {
        return Ok("attachments_sent");
      }
    }

    return this.sendText(client, params);
  }

  private async sendText(client: ChatwootClient, params: SendParams): Promise<Result<string, SendError>> {
    let lastError = "";

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const result = await client.sendMessage(params.accountId, params.conversationId, params.content);

      if (result.ok) {
        return Ok(String(result.data.id));
      }

      lastError = result.error;

      if (result.status === 429) {
        return Err({ code: "RATE_LIMITED", message: lastError });
      }

      if (result.status >= 400 && result.status < 500 && result.status !== 429) {
        return Err({ code: "API_ERROR", message: lastError });
      }

      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      logger.warn("Chatwoot send retry", { attempt, delay, error: lastError });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return Err({ code: "NETWORK_ERROR", message: `Failed after ${MAX_RETRIES} retries: ${lastError}` });
  }
}
