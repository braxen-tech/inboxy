import { createHmac, timingSafeEqual } from "node:crypto";
import type { VerifiedPayload, WebhookError, InboundMessage } from "@/domain/ports";
import { Ok, Err, type Result } from "@/domain/errors";
import { toPhoneNumber } from "@/domain/value-objects";

export function verifySignature(
  body: string,
  signature: string | null,
  appSecret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", appSecret).update(body).digest("hex");
  const sigHash = signature.replace("sha256=", "");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sigHash, "hex"));
  } catch {
    return false;
  }
}

interface WhatsAppWebhookBody {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { phone_number_id: string; display_phone_number: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: Array<{
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
        statuses?: unknown[];
      };
      field: string;
    }>;
  }>;
}

export function parseWebhookBody(payload: VerifiedPayload): InboundMessage[] {
  const body = payload.raw as WhatsAppWebhookBody;
  const messages: InboundMessage[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const val = change.value;
      if (!val.messages) continue;

      const contactsMap = new Map(
        (val.contacts ?? []).map((c) => [c.wa_id, c.profile.name]),
      );

      for (const msg of val.messages) {
        if (msg.type !== "text" || !msg.text?.body) continue;
        messages.push({
          whatsappMessageId: msg.id,
          from: toPhoneNumber(msg.from),
          profileName: contactsMap.get(msg.from) ?? null,
          content: msg.text.body,
          timestamp: new Date(parseInt(msg.timestamp) * 1000),
          phoneNumberId: val.metadata.phone_number_id,
        });
      }
    }
  }

  return messages;
}

export async function verifyWebhookRequest(
  request: Request,
  appSecret: string,
): Promise<Result<VerifiedPayload, WebhookError>> {
  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifySignature(body, signature, appSecret)) {
    return Err({ code: "SIGNATURE_INVALID", message: "Invalid X-Hub-Signature-256" });
  }

  try {
    const parsed = JSON.parse(body);
    return Ok({ raw: parsed });
  } catch {
    return Err({ code: "PARSE_FAILED", message: "Failed to parse webhook body as JSON" });
  }
}

export const whatsAppWebhookHelpers = {
  verifySignature,
  parseWebhookBody,
  verifyWebhookRequest,
};
