import type { SupabaseClient } from "@supabase/supabase-js";
import type { SecretStore } from "@/domain/ports";
import { Ok, Err, type Result } from "@/domain/errors";
import { DomainError } from "@/domain/errors";
import { ChatwootClient } from "@/infrastructure/adapters/chatwoot/client";
import { logger } from "@/lib/logger";
import { randomUUID } from "node:crypto";

interface ConnectInput {
  orgId: string;
  apiUrl: string;
  apiToken: string;
  accountId: string;
  appUrl: string;
}

interface ConnectOutput {
  accountId: string;
  webhookUrl: string;
}

export async function connectChatwoot(
  db: SupabaseClient,
  secretStore: SecretStore,
  input: ConnectInput,
): Promise<Result<ConnectOutput, DomainError>> {
  const { orgId, apiUrl, apiToken, accountId, appUrl } = input;
  const ctx = { orgId };

  const normalizedUrl = apiUrl.replace(/\/+$/, "");

  if (!normalizedUrl || !apiToken || !accountId) {
    return Err(
      new DomainError("CHATWOOT_CONNECT_FAILED", "Preencha URL, API Token e Account ID."),
    );
  }

  const client = new ChatwootClient(normalizedUrl, apiToken);

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

  const webhookSecret = randomUUID();
  const webhookUrl = `${appUrl.replace(/\/+$/, "")}/api/webhooks/chatwoot?secret=${webhookSecret}`;

  const existingWebhooks = await client.listWebhooks(accountId);
  if (existingWebhooks.ok) {
    const raw = existingWebhooks.data;
    let webhookList: { id: number; url: string }[] = [];
    if (Array.isArray(raw)) {
      webhookList = raw;
    } else if (raw && typeof raw === "object") {
      const candidate = (raw as Record<string, unknown>).payload ?? (raw as Record<string, unknown>).data;
      if (Array.isArray(candidate)) {
        webhookList = candidate;
      }
    }

    for (const wh of webhookList) {
      if (wh.url?.includes("/api/webhooks/chatwoot")) {
        logger.info("Removing old webhook", { ...ctx, webhookId: wh.id, url: wh.url });
        await client.deleteWebhook(accountId, wh.id);
      }
    }
  }

  const webhookResult = await client.createWebhook(accountId, webhookUrl, ["message_created"]);
  if (!webhookResult.ok) {
    logger.error("Chatwoot connect: webhook creation failed", {
      ...ctx,
      error: webhookResult.error,
    });
    return Err(
      new DomainError(
        "CHATWOOT_CONNECT_FAILED",
        `Falha ao criar webhook no Chatwoot: ${webhookResult.error}`,
      ),
    );
  }

  const { error: updateError } = await db
    .from("organizations")
    .update({
      chatwoot_api_url: normalizedUrl,
      chatwoot_api_token: secretStore.encrypt(apiToken),
      chatwoot_account_id: accountId,
      chatwoot_webhook_secret: webhookSecret,
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

  logger.info("Chatwoot connected", {
    ...ctx,
    accountId,
    webhookUrl,
    profile: profileResult.data.name,
  });

  return Ok({ accountId, webhookUrl });
}

export async function disconnectChatwoot(
  db: SupabaseClient,
  orgId: string,
): Promise<Result<void, DomainError>> {
  const { error } = await db
    .from("organizations")
    .update({ chatwoot_status: "disconnected" })
    .eq("id", orgId);

  if (error) {
    return Err(new DomainError("CHATWOOT_CONNECT_FAILED", error.message));
  }

  return Ok(undefined);
}
