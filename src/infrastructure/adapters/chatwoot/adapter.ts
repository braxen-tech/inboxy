import type { MessagingChannel, InboundMessage, SendParams, SendTarget, SendError, WebhookError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { ChatwootClient } from "./client";
import { logger } from "@/lib/logger";
import { parseChatwootChannel } from "@/lib/chatwoot-channel";

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
    channel?: string;
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

    if (payload.sender?.type === "user") {
      return Err({ code: "IGNORED_EVENT", message: "Ignored: agent message" });
    }

    if (payload.private) {
      return Err({ code: "IGNORED_EVENT", message: "Ignored: private note" });
    }

    if (!payload.content || payload.content.trim().length === 0) {
      return Err({ code: "IGNORED_EVENT", message: "Ignored: empty content" });
    }

    const message: InboundMessage = {
      channel: "chatwoot",
      externalMessageId: String(payload.id),
      externalConversationId: String(payload.conversation.id),
      senderExternalId: payload.sender.id != null ? String(payload.sender.id) : null,
      senderName: payload.sender.name ?? null,
      senderPhone: payload.sender.phone_number ?? null,
      senderEmail: payload.sender.email ?? null,
      chatwoot: {
        conversationId: payload.conversation.id,
        senderId: payload.sender.id ?? null,
        channel: parseChatwootChannel(payload.conversation.channel),
        inboxId: payload.conversation.inbox_id ?? null,
      },
      content: payload.content,
      timestamp: new Date(payload.created_at),
      accountId: String(payload.account.id),
    };

    return Ok([message]);
  }

  async send(params: SendParams): Promise<Result<string, SendError>> {
    const target = params.target;
    if (target.kind !== "chatwoot") {
      return Err({ code: "API_ERROR", message: `ChatwootAdapter cannot send to ${target.kind}` });
    }
    const client = new ChatwootClient(target.apiUrl, target.apiToken);

    if (params.attachments?.length) {
      for (const att of params.attachments) {
        const result = await client.sendMessageWithAttachment(
          target.accountId,
          target.conversationId,
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

    return this.sendText(client, { ...params, target });
  }

  private async sendText(
    client: ChatwootClient,
    params: SendParams<Extract<SendTarget, { kind: "chatwoot" }>>,
  ): Promise<Result<string, SendError>> {
    const { target } = params;
    let lastError = "";

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const result = await client.sendMessage(
        target.accountId,
        target.conversationId,
        params.content,
        target.agentBotId != null ? { agentBotId: target.agentBotId } : undefined,
      );

      if (result.ok) {
        return Ok(String(result.data.id));
      }

      lastError = result.error;

      if (result.status === 429) {
        return Err({ code: "RATE_LIMITED", message: lastError, httpStatus: 429 });
      }

      if (result.status === 401) {
        return Err({ code: "UNAUTHORIZED", message: lastError, httpStatus: 401 });
      }

      if (result.status >= 400 && result.status < 500 && result.status !== 429) {
        return Err({ code: "API_ERROR", message: lastError, httpStatus: result.status });
      }

      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      logger.warn("Chatwoot send retry", { attempt, delay, error: lastError });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return Err({ code: "NETWORK_ERROR", message: `Failed after ${MAX_RETRIES} retries: ${lastError}` });
  }
}
