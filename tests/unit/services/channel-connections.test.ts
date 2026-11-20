import { describe, it, expect } from "vitest";
import type { InboundMessage, SecretStore } from "@/domain/ports";
import {
  buildSendTarget,
  inboundWebhookSecret,
  nativeIngestParams,
  type ChannelConnection,
} from "@/application/services/channel-connections";

const secretStore: SecretStore = {
  encrypt: (v) => `enc(${v})`,
  decrypt: (v) => v.replace(/^enc\((.*)\)$/, "$1"),
};

const wa: ChannelConnection = {
  id: "conn-wa",
  organization_id: "org-1",
  channel: "whatsapp_cloud",
  status: "active",
  webhook_secret: "verify-token",
  config: { phone_number_id: "pn-1", access_token_enc: "enc(tok)", app_secret_enc: "enc(appsecret)" },
};

const tg: ChannelConnection = {
  id: "conn-tg",
  organization_id: "org-1",
  channel: "telegram",
  status: "active",
  webhook_secret: "tg-secret",
  config: { bot_id: "1", bot_token_enc: "enc(123:abc)" },
};

const baseMsg: InboundMessage = {
  channel: "telegram",
  externalMessageId: "555:77",
  externalConversationId: "555",
  senderExternalId: "555",
  senderName: "João",
  senderPhone: null,
  senderEmail: null,
  content: "oi",
  timestamp: new Date(),
  accountId: "",
};

describe("channel-connections", () => {
  it("uses the Meta app secret for WhatsApp and the secret_token for Telegram", () => {
    expect(inboundWebhookSecret(wa, secretStore)).toBe("appsecret");
    expect(inboundWebhookSecret(tg, secretStore)).toBe("tg-secret");
  });

  it("builds decrypted send targets", () => {
    expect(buildSendTarget(wa, secretStore, "5511999990000")).toEqual({
      kind: "whatsapp_cloud",
      phoneNumberId: "pn-1",
      accessToken: "tok",
      to: "5511999990000",
    });
    expect(buildSendTarget(tg, secretStore, "555")).toEqual({ kind: "telegram", botToken: "123:abc", chatId: "555" });
  });

  it("scopes Telegram event ids to the connection (message_id is per chat)", () => {
    const params = nativeIngestParams(tg, baseMsg);
    expect(params.eventId).toBe("tg:conn-tg:555:77");
    expect(params.contactIdentifier).toBe("tg:555");
    expect(params.key).toEqual({
      kind: "connection",
      connectionId: "conn-tg",
      channel: "telegram",
      externalContactId: "555",
    });
  });

  it("keys WhatsApp contacts by E.164 phone so they match existing contacts", () => {
    const params = nativeIngestParams(wa, {
      ...baseMsg,
      channel: "whatsapp_cloud",
      externalMessageId: "wamid.X",
      externalConversationId: "5511999990000",
      senderPhone: "+5511999990000",
    });
    expect(params.eventId).toBe("wa:wamid.X");
    expect(params.contactIdentifier).toBe("+5511999990000");
    expect(params.contactMetadata).toEqual({ whatsapp_wa_id: "5511999990000" });
  });
});
