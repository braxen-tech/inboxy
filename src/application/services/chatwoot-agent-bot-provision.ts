import type { SupabaseClient } from "@supabase/supabase-js";
import type { SecretStore } from "@/domain/ports";
import {
  ChatwootClient,
  type ChatwootInboxSummary,
} from "@/infrastructure/adapters/chatwoot/client";
import { sanitizeAgentBotName } from "@/lib/chatwoot-agent-bot";
import { logger } from "@/lib/logger";

export interface InboxLinkResult {
  id: number;
  name: string;
}

export interface InboxLinkFailure {
  id: number;
  name: string;
  error: string;
}

export interface ProvisionAgentBotResult {
  botId: number;
  botAccessToken: string | null;
  linkedInboxes: InboxLinkResult[];
  failedInboxes: InboxLinkFailure[];
}

export async function linkBotToInbox(
  client: ChatwootClient,
  accountId: string,
  inboxId: number,
  agentBotId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await client.setInboxAgentBot(accountId, inboxId, agentBotId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true };
}

export async function linkBotToAllInboxes(
  client: ChatwootClient,
  accountId: string,
  agentBotId: number,
  inboxes: ChatwootInboxSummary[],
  ctx: Record<string, string> = {},
): Promise<{ linkedInboxes: InboxLinkResult[]; failedInboxes: InboxLinkFailure[] }> {
  const linkedInboxes: InboxLinkResult[] = [];
  const failedInboxes: InboxLinkFailure[] = [];

  for (const inbox of inboxes) {
    const link = await linkBotToInbox(client, accountId, inbox.id, agentBotId);
    if (link.ok) {
      linkedInboxes.push({ id: inbox.id, name: inbox.name });
      logger.info("Linked agent bot to inbox", { ...ctx, inboxId: inbox.id, inboxName: inbox.name });
    } else {
      failedInboxes.push({ id: inbox.id, name: inbox.name, error: link.error });
      logger.warn("Failed to link agent bot to inbox", {
        ...ctx,
        inboxId: inbox.id,
        error: link.error,
      });
    }
  }

  return { linkedInboxes, failedInboxes };
}

function resolveBotId(data: { id?: number }): number | null {
  if (typeof data.id === "number") return data.id;
  return null;
}

function resolveBotAccessToken(data: { access_token?: string | null }): string | null {
  const token = data.access_token?.trim();
  return token || null;
}

/** Obtains bot access token from payload, GET, or reset_access_token (Chatwoot Cloud). */
export async function ensureBotAccessToken(
  client: ChatwootClient,
  accountId: string,
  botId: string,
  fromPayload?: { access_token?: string | null },
  ctx: Record<string, string> = {},
): Promise<string | null> {
  let token = resolveBotAccessToken(fromPayload ?? {});
  if (token) return token;

  const details = await client.getAgentBot(accountId, botId);
  if (details.ok) {
    token = resolveBotAccessToken(details.data);
    if (token) return token;
  }

  const reset = await client.resetAgentBotAccessToken(accountId, botId);
  if (reset.ok) {
    token = resolveBotAccessToken(reset.data);
    if (token) {
      logger.info("Agent bot access token regenerated", { ...ctx, botId });
      return token;
    }
  }

  logger.warn("Agent bot access token unavailable after reset", { ...ctx, botId });
  return null;
}

/** Regenerates bot token via admin API and persists encrypted value on the org. */
export async function regenerateAndStoreBotToken(
  db: SupabaseClient,
  secretStore: SecretStore,
  orgId: string,
  org: {
    chatwoot_api_url: string;
    chatwoot_api_token: string;
    chatwoot_account_id: string;
    chatwoot_agent_bot_id: string;
  },
  ctx: Record<string, string> = {},
): Promise<string | null> {
  try {
    const adminToken = secretStore.decrypt(org.chatwoot_api_token);
    const client = new ChatwootClient(org.chatwoot_api_url, adminToken);
    const reset = await client.resetAgentBotAccessToken(
      org.chatwoot_account_id,
      org.chatwoot_agent_bot_id,
    );
    if (!reset.ok) {
      logger.warn("reset_access_token failed", { ...ctx, error: reset.error });
      return null;
    }
    const token = resolveBotAccessToken(reset.data);
    if (!token) return null;

    const { error } = await db
      .from("organizations")
      .update({ chatwoot_agent_bot_access_token: secretStore.encrypt(token) })
      .eq("id", orgId);

    if (error) {
      logger.error("Failed to persist regenerated bot token", { ...ctx, error: error.message });
      return null;
    }

    logger.info("Regenerated and stored agent bot access token", ctx);
    return token;
  } catch (err) {
    logger.warn("regenerateAndStoreBotToken error", { ...ctx, error: String(err) });
    return null;
  }
}

/** Creates a new Agent Bot and links it to all account inboxes. */
export async function provisionChatwootAgentBot(
  client: ChatwootClient,
  accountId: string,
  orgName: string,
  outgoingUrl: string,
  ctx: Record<string, string> = {},
): Promise<
  | { ok: true; result: ProvisionAgentBotResult }
  | { ok: false; error: string }
> {
  const createResult = await client.createAgentBot(accountId, {
    name: sanitizeAgentBotName(orgName),
    outgoingUrl,
    description: "Agente IA Inboxy (handoff pending/open)",
  });

  if (!createResult.ok) {
    return { ok: false, error: createResult.error };
  }

  const botId = resolveBotId(createResult.data);
  if (botId == null) {
    return { ok: false, error: "Chatwoot não retornou ID do Agent Bot." };
  }

  const botAccessToken = await ensureBotAccessToken(
    client,
    accountId,
    String(botId),
    createResult.data,
    ctx,
  );

  const inboxesResult = await client.listInboxes(accountId);
  if (!inboxesResult.ok) {
    return { ok: false, error: `Falha ao listar inboxes: ${inboxesResult.error}` };
  }

  const inboxes = inboxesResult.data;
  const { linkedInboxes, failedInboxes } = await linkBotToAllInboxes(
    client,
    accountId,
    botId,
    inboxes,
    ctx,
  );

  return {
    ok: true,
    result: { botId, botAccessToken, linkedInboxes, failedInboxes },
  };
}

/** Updates outgoing URL and re-links all inboxes (reconnect). */
export async function refreshChatwootAgentBot(
  client: ChatwootClient,
  accountId: string,
  botId: string,
  outgoingUrl: string,
  ctx: Record<string, string> = {},
): Promise<
  | { ok: true; result: Omit<ProvisionAgentBotResult, "botId"> & { botId: number } }
  | { ok: false; error: string }
> {
  const updateResult = await client.updateAgentBot(accountId, botId, { outgoingUrl });
  if (!updateResult.ok) {
    return { ok: false, error: updateResult.error };
  }

  const numericBotId = Number(botId);

  const botAccessToken = await ensureBotAccessToken(
    client,
    accountId,
    botId,
    updateResult.data,
    ctx,
  );

  const inboxesResult = await client.listInboxes(accountId);
  if (!inboxesResult.ok) {
    return { ok: false, error: `Falha ao listar inboxes: ${inboxesResult.error}` };
  }

  const { linkedInboxes, failedInboxes } = await linkBotToAllInboxes(
    client,
    accountId,
    numericBotId,
    inboxesResult.data,
    ctx,
  );

  return {
    ok: true,
    result: { botId: numericBotId, botAccessToken, linkedInboxes, failedInboxes },
  };
}
