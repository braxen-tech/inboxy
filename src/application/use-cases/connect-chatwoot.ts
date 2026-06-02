import type { SupabaseClient } from "@supabase/supabase-js";
import type { SecretStore } from "@/domain/ports";
import { Ok, Err, type Result } from "@/domain/errors";
import { DomainError } from "@/domain/errors";
import { ChatwootClient, unwrapChatwootList } from "@/infrastructure/adapters/chatwoot/client";
import {
  provisionChatwootAgentBot,
  refreshChatwootAgentBot,
  type InboxLinkFailure,
  type InboxLinkResult,
} from "@/application/services/chatwoot-agent-bot-provision";
import {
  buildAccountEventsWebhookUrl,
  buildAgentBotWebhookUrl,
} from "@/lib/chatwoot-agent-bot";
import { logger } from "@/lib/logger";
import { randomUUID } from "node:crypto";

interface ConnectInput {
  orgId: string;
  orgName: string;
  apiUrl: string;
  apiToken: string;
  accountId: string;
}

export interface ConnectOutput {
  accountId: string;
  agentBotWebhookUrl: string;
  botId: number;
  hasBotAccessToken: boolean;
  linkedInboxes: InboxLinkResult[];
  failedInboxes: InboxLinkFailure[];
}

async function removeInboxyAccountWebhooks(
  client: ChatwootClient,
  accountId: string,
  ctx: Record<string, string>,
): Promise<void> {
  const existingWebhooks = await client.listWebhooks(accountId);
  if (!existingWebhooks.ok) return;

  const webhookList = unwrapChatwootList<{ id: number; url: string }>(existingWebhooks.data);

  for (const wh of webhookList) {
    if (wh.url?.includes("/api/webhooks/chatwoot")) {
      logger.info("Removing Inboxy account webhook", {
        ...ctx,
        webhookId: wh.id,
        url: wh.url,
      });
      await client.deleteWebhook(accountId, wh.id);
    }
  }
}

async function ensureInboxCreatedWebhook(
  client: ChatwootClient,
  accountId: string,
  accountWebhookSecret: string,
  ctx: Record<string, string>,
): Promise<Result<void, DomainError>> {
  const webhookUrl = buildAccountEventsWebhookUrl(accountWebhookSecret);
  const createResult = await client.createWebhook(accountId, webhookUrl, ["inbox_created"]);

  if (!createResult.ok) {
    logger.error("Failed to register inbox_created webhook", {
      ...ctx,
      error: createResult.error,
    });
    return Err(
      new DomainError(
        "CHATWOOT_CONNECT_FAILED",
        `Não foi possível registrar webhook de inboxes: ${createResult.error}. Verifique permissões de administrador no Chatwoot.`,
      ),
    );
  }

  logger.info("Registered inbox_created account webhook", { ...ctx, webhookUrl });
  return Ok(undefined);
}

export async function connectChatwoot(
  db: SupabaseClient,
  secretStore: SecretStore,
  input: ConnectInput,
): Promise<Result<ConnectOutput, DomainError>> {
  const { orgId, orgName, apiUrl, apiToken, accountId } = input;
  const ctx = { orgId };

  const normalizedUrl = apiUrl.replace(/\/+$/, "");

  if (!normalizedUrl || !apiToken?.trim() || !accountId) {
    return Err(
      new DomainError(
        "CHATWOOT_CONNECT_FAILED",
        "Preencha URL do Chatwoot, Account ID e API Access Token.",
      ),
    );
  }

  const client = new ChatwootClient(normalizedUrl, apiToken.trim());

  const profileResult = await client.validateToken();
  if (!profileResult.ok) {
    logger.error("Chatwoot connect: invalid token", { ...ctx, error: profileResult.error });
    return Err(
      new DomainError(
        "CHATWOOT_CONNECT_FAILED",
        `Token inválido ou URL incorreta: ${profileResult.error}`,
      ),
    );
  }

  const { data: prior } = await db
    .from("organizations")
    .select(
      "chatwoot_agent_bot_webhook_secret, chatwoot_webhook_secret, chatwoot_agent_bot_id",
    )
    .eq("id", orgId)
    .single();

  const agentBotWebhookSecret =
    prior?.chatwoot_agent_bot_webhook_secret ?? randomUUID();
  const accountWebhookSecret = prior?.chatwoot_webhook_secret ?? randomUUID();
  const agentBotWebhookUrl = buildAgentBotWebhookUrl(agentBotWebhookSecret);

  let botId: number;
  let botAccessToken: string | null = null;
  let linkedInboxes: InboxLinkResult[];
  let failedInboxes: InboxLinkFailure[];

  const existingBotId = prior?.chatwoot_agent_bot_id?.trim();

  if (existingBotId) {
    const refresh = await refreshChatwootAgentBot(
      client,
      accountId,
      existingBotId,
      agentBotWebhookUrl,
      ctx,
    );
    if (!refresh.ok) {
      return Err(
        new DomainError(
          "CHATWOOT_CONNECT_FAILED",
          `Falha ao atualizar Agent Bot: ${refresh.error}`,
        ),
      );
    }
    botId = refresh.result.botId;
    botAccessToken = refresh.result.botAccessToken;
    linkedInboxes = refresh.result.linkedInboxes;
    failedInboxes = refresh.result.failedInboxes;
  } else {
    const provision = await provisionChatwootAgentBot(
      client,
      accountId,
      orgName,
      agentBotWebhookUrl,
      ctx,
    );
    if (!provision.ok) {
      const hint =
        provision.error.includes("403") || provision.error.toLowerCase().includes("access")
          ? " O token precisa ser de um administrador da conta Chatwoot."
          : "";
      return Err(
        new DomainError(
          "CHATWOOT_CONNECT_FAILED",
          `Falha ao criar Agent Bot: ${provision.error}.${hint}`,
        ),
      );
    }
    botId = provision.result.botId;
    botAccessToken = provision.result.botAccessToken;
    linkedInboxes = provision.result.linkedInboxes;
    failedInboxes = provision.result.failedInboxes;
  }

  if (!botAccessToken) {
    logger.warn("Agent bot access token not returned; outgoing messages may use user token", ctx);
  }

  await removeInboxyAccountWebhooks(client, accountId, ctx);

  const webhookResult = await ensureInboxCreatedWebhook(
    client,
    accountId,
    accountWebhookSecret,
    ctx,
  );
  if (!webhookResult.ok) return webhookResult;

  const { error: updateError } = await db
    .from("organizations")
    .update({
      chatwoot_api_url: normalizedUrl,
      chatwoot_api_token: secretStore.encrypt(apiToken.trim()),
      chatwoot_account_id: accountId,
      chatwoot_webhook_secret: accountWebhookSecret,
      chatwoot_agent_bot_id: String(botId),
      chatwoot_agent_bot_access_token: botAccessToken
        ? secretStore.encrypt(botAccessToken)
        : null,
      chatwoot_agent_bot_webhook_secret: agentBotWebhookSecret,
      chatwoot_status: "active",
    })
    .eq("id", orgId);

  if (updateError) {
    logger.error("Chatwoot connect: DB update failed", {
      ...ctx,
      error: updateError.message,
    });
    return Err(new DomainError("CHATWOOT_CONNECT_FAILED", "Falha ao salvar credenciais."));
  }

  logger.info("Chatwoot connected with auto agent bot", {
    ...ctx,
    accountId,
    botId,
    linkedCount: linkedInboxes.length,
    failedCount: failedInboxes.length,
    agentBotWebhookUrl,
  });

  return Ok({
    accountId,
    agentBotWebhookUrl,
    botId,
    hasBotAccessToken: !!botAccessToken,
    linkedInboxes,
    failedInboxes,
  });
}

export async function disconnectChatwoot(
  db: SupabaseClient,
  orgId: string,
): Promise<Result<void, DomainError>> {
  const { error } = await db
    .from("organizations")
    .update({
      chatwoot_status: "disconnected",
      chatwoot_agent_bot_id: null,
      chatwoot_agent_bot_access_token: null,
      chatwoot_agent_bot_webhook_secret: null,
      chatwoot_webhook_secret: null,
    })
    .eq("id", orgId);

  if (error) {
    return Err(new DomainError("CHATWOOT_CONNECT_FAILED", error.message));
  }

  return Ok(undefined);
}
