import type { MessagingChannel, VerifiedPayload, WebhookError, InboundMessage, SendParams, SendError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { logger } from "@/lib/logger";
import { verifyWebhookRequest, parseWebhookBody } from "./webhook";
import { sendTextMessage } from "./graph-client";

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

export class WhatsAppCloudAdapter implements MessagingChannel {
  async verifyWebhook(request: Request, appSecret: string): Promise<Result<VerifiedPayload, WebhookError>> {
    return verifyWebhookRequest(request, appSecret);
  }

  parseInbound(payload: VerifiedPayload): InboundMessage[] {
    return parseWebhookBody(payload);
  }

  async send(params: SendParams): Promise<Result<string, SendError>> {
    let lastError: string = "";

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const result = await sendTextMessage(
        params.phoneNumberId,
        params.to,
        params.content,
        params.accessToken,
      );

      if (result.ok) {
        const messageId = result.data.messages?.[0]?.id ?? "";
        return Ok(messageId);
      }

      lastError = result.error.message;

      if (result.status === 429) {
        return Err({ code: "RATE_LIMITED", message: lastError });
      }

      if (result.error.code === 131047) {
        return Err({ code: "OUTSIDE_24H", message: "Message failed: outside 24h customer service window" });
      }

      if (result.status >= 400 && result.status < 500 && result.status !== 429) {
        return Err({ code: "API_ERROR", message: lastError });
      }

      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      logger.warn("WhatsApp send retry", { attempt, delay, error: lastError, orgId: params.orgId });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return Err({ code: "NETWORK_ERROR", message: `Failed after ${MAX_RETRIES} retries: ${lastError}` });
  }
}
