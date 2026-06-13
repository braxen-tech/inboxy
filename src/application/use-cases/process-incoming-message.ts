import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentRunner, MessagingChannel, ToolRegistry } from "@/domain/ports";
import type { SecretStore } from "@/domain/ports";
import type { MessageId, ConversationId } from "@/domain/value-objects";
import { toOrgId, toCorrelationId } from "@/domain/value-objects";
import { acquireConversationLock, releaseConversationLock } from "../services/conversation-lock";
import { getMonthlyUsage } from "../services/monthly-usage";
import { notifyQuotaExceeded } from "../services/quota-notification";
import { incrementUsage } from "../services/usage-tracker";
import { needsBillingSetup } from "@/lib/billing-setup";
import { isBotQueueStatus } from "@/lib/conversation-status";
import {
  QUOTA_HANDOFF_MESSAGE,
  resolveEnabledToolsForOrg,
} from "@/lib/plans";
import { ChatwootClient } from "@/infrastructure/adapters/chatwoot/client";
import { handoffConversationToHuman } from "@/application/services/conversation-handoff";
import { regenerateAndStoreBotToken } from "@/application/services/chatwoot-agent-bot-provision";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";

const BILLING_ACTIVE_STATUSES = new Set(["active", "trialing"]);

async function orgHasReadyKbDocuments(db: SupabaseClient, orgId: string): Promise<boolean> {
  const { count, error } = await db
    .from("kb_documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "ready");

  if (error) {
    logger.warn("Failed to check KB documents", { orgId, error: error.message });
    return false;
  }

  return (count ?? 0) > 0;
}

interface Deps {
  db: SupabaseClient;
  agentRunner: AgentRunner;
  messagingChannel: MessagingChannel;
  toolRegistry: ToolRegistry;
  secretStore: SecretStore;
}

interface Input {
  orgId: string;
  conversationId: string;
  messageId: string;
  correlationId: string;
}

export async function processIncomingMessage(deps: Deps, input: Input): Promise<void> {
  const { db, agentRunner, messagingChannel, toolRegistry, secretStore } = deps;
  const { orgId, conversationId, messageId, correlationId } = input;
  const ctx = { correlationId, orgId, conversationId };

  const locked = await acquireConversationLock(db, conversationId, correlationId);
  if (!locked) {
    logger.info("Conversation already locked, skipping", ctx);
    return;
  }

  try {
    const { data: org } = await db
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

    if (!org || org.chatwoot_status !== "active") {
      logger.warn("Org not found or Chatwoot disconnected", ctx);
      return;
    }

    if (needsBillingSetup(org)) {
      logger.warn("Billing setup incomplete, bot skipping", ctx);
      return;
    }

    const { data: conversation } = await db
      .from("conversations")
      .select("*, contacts(*)")
      .eq("id", conversationId)
      .single();

    if (!conversation) {
      logger.error("Conversation not found", ctx);
      return;
    }

    if (!isBotQueueStatus(conversation.status)) {
      logger.info("Conversation not in bot queue, skipping", {
        ...ctx,
        status: conversation.status,
      });
      return;
    }

    const subscriptionStatus = org.subscription_status ?? "trialing";
    if (!BILLING_ACTIVE_STATUSES.has(subscriptionStatus)) {
      logger.warn("Subscription not active, bot skipping", { ...ctx, subscriptionStatus });
      return;
    }

    const messageQuota = org.message_quota ?? 500;
    const monthlyUsage = await getMonthlyUsage(db, orgId);

    if (monthlyUsage.messagesOut >= messageQuota) {
      let handoffToken: string | undefined;
      try {
        handoffToken = secretStore.decrypt(org.chatwoot_api_token);
      } catch {
        logger.error("Quota handoff: cannot decrypt Chatwoot token", ctx);
      }

      if (handoffToken && org.chatwoot_account_id && conversation.chatwoot_conversation_id) {
        let botHandoffToken: string | null = null;
        if (org.chatwoot_agent_bot_access_token) {
          try {
            botHandoffToken = secretStore.decrypt(org.chatwoot_agent_bot_access_token);
          } catch {
            /* use admin toggle only */
          }
        }
        await handoffConversationToHuman({
          db,
          orgId,
          conversationId,
          chatwoot: {
            apiUrl: org.chatwoot_api_url,
            adminToken: handoffToken,
            botToken: botHandoffToken,
            accountId: org.chatwoot_account_id,
            conversationId: conversation.chatwoot_conversation_id,
          },
          logContext: { ...ctx, trigger: "quota" },
        });

        await messagingChannel.send({
          apiUrl: org.chatwoot_api_url,
          apiToken: handoffToken,
          accountId: org.chatwoot_account_id,
          conversationId: conversation.chatwoot_conversation_id,
          content: QUOTA_HANDOFF_MESSAGE,
        });
      } else {
        await db.from("conversations").update({ status: "open" }).eq("id", conversationId);
      }

      await notifyQuotaExceeded(db, orgId, org.owner_user_id, {
        messagesOut: monthlyUsage.messagesOut,
        quota: messageQuota,
      });

      logger.warn("Quota exceeded, switching to open (human)", {
        ...ctx,
        messagesOut: monthlyUsage.messagesOut,
        quota: messageQuota,
      });
      captureServerEvent("quota_exceeded_handoff", {
        ...ctx,
        messages_out: monthlyUsage.messagesOut,
        quota: messageQuota,
      });
      return;
    }

    const { data: messages } = await db
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(100);

    const history = (messages ?? []).map((m: Record<string, unknown>) => ({
      id: m.id as MessageId,
      organizationId: toOrgId(m.organization_id as string),
      conversationId: m.conversation_id as ConversationId,
      direction: m.direction as "inbound" | "outbound",
      content: m.content as string,
      externalMessageId: m.external_message_id as string | null,
      status: m.status as "received" | "processing" | "replied" | "failed",
      aiMetadata: m.ai_metadata as Record<string, unknown> | null,
      correlationId: m.correlation_id ? toCorrelationId(m.correlation_id as string) : null,
      createdAt: new Date(m.created_at as string),
    }));

    const enabledToolNames = resolveEnabledToolsForOrg({
      ...org,
      hasKbDocuments: await orgHasReadyKbDocuments(db, orgId),
    });
    const tools = toolRegistry.getToolsForOrg(toOrgId(orgId), enabledToolNames);

    let calendarCtx: import("@/domain/ports").CalendarContext | undefined;
    if (org.cal_status === "active" && org.cal_api_key && org.cal_event_type_id) {
      calendarCtx = {
        eventTypeId: org.cal_event_type_id,
        apiToken: secretStore.decrypt(org.cal_api_key),
        timezone: org.cal_timezone ?? "America/Sao_Paulo",
        bookingUrl: org.cal_booking_url ?? null,
      };
    }

    let stripeCtx: import("@/domain/ports").StripeContext | undefined;
    if (org.stripe_status === "active" && org.stripe_secret_key) {
      stripeCtx = { apiKey: secretStore.decrypt(org.stripe_secret_key) };
    }

    let chatwootCtx: import("@/domain/ports").ChatwootContext | undefined;
    if (org.chatwoot_status === "active" && org.chatwoot_api_token && org.chatwoot_account_id) {
      let botAccessToken: string | null = null;
      if (org.chatwoot_agent_bot_access_token) {
        try {
          botAccessToken = secretStore.decrypt(org.chatwoot_agent_bot_access_token);
        } catch {
          logger.warn("Cannot decrypt bot token for handoff tool", ctx);
        }
      }
      chatwootCtx = {
        apiUrl: org.chatwoot_api_url,
        apiToken: secretStore.decrypt(org.chatwoot_api_token),
        botAccessToken,
        accountId: org.chatwoot_account_id,
        conversationId: conversation.chatwoot_conversation_id,
      };
      logger.info("Chatwoot context initialized", { accountId: org.chatwoot_account_id, conversationId: conversation.chatwoot_conversation_id });
    } else {
      logger.warn("Chatwoot context not available", { chatwoot_status: org.chatwoot_status, has_api_token: !!org.chatwoot_api_token, has_account_id: !!org.chatwoot_account_id });
    }

    const toolContext = {
      orgId: toOrgId(orgId),
      contactPhone: conversation.contacts?.phone ?? "",
      conversationId,
      calendar: calendarCtx,
      stripe: stripeCtx,
      chatwoot: chatwootCtx,
    };

    logger.info("Running agent", {
      ...ctx,
      toolCount: tools.length,
      toolNames: tools.map((t) => t.name),
      calendarEnabled: !!calendarCtx,
      historyLength: history.length,
    });

    const agentResult = await agentRunner.run({
      systemPrompt: org.system_prompt,
      knowledgeBase: org.knowledge_base,
      history,
      tools,
      toolContext,
      orgId: toOrgId(orgId),
      model: org.model,
      language: org.language,
    });

    if (!agentResult.ok) {
      logger.error("Agent run failed", { ...ctx, error: agentResult.error });
      await db
        .from("messages")
        .update({ status: "failed" })
        .eq("id", messageId);
      return;
    }

    const { reply, inputTokens, outputTokens } = agentResult.value;

    if (!reply || reply.trim().length === 0) {
      logger.warn("Agent returned empty reply", ctx);
      return;
    }

    const agentBotConfigured = !!org.chatwoot_agent_bot_id;
    let sendToken: string | null = null;
    if (org.chatwoot_agent_bot_access_token) {
      try {
        sendToken = secretStore.decrypt(org.chatwoot_agent_bot_access_token);
      } catch {
        logger.warn("Cannot decrypt agent bot token", ctx);
      }
    }

    if (agentBotConfigured && !sendToken) {
      logger.error(
        "Agent Bot configurado sem access_token — reconecte Chatwoot em Integrações",
        ctx,
      );
      await db.from("messages").update({ status: "failed" }).eq("id", messageId);
      return;
    }

    const usedBotToken = !!sendToken;
    if (!sendToken && org.chatwoot_api_token) {
      try {
        sendToken = secretStore.decrypt(org.chatwoot_api_token);
      } catch {
        logger.error(
          "Cannot decrypt Chatwoot API token — reconnect in Integrações (ENCRYPTION_KEY may have changed)",
          ctx,
        );
        await db
          .from("messages")
          .update({ status: "failed" })
          .eq("id", messageId);
        return;
      }
    }
    if (!sendToken) {
      logger.error("No Chatwoot token available for send", ctx);
      await db.from("messages").update({ status: "failed" }).eq("id", messageId);
      return;
    }

    const { data: statusRow } = await db
      .from("conversations")
      .select("status")
      .eq("id", conversationId)
      .single();

    if (
      usedBotToken &&
      isBotQueueStatus(statusRow?.status ?? conversation.status) &&
      org.chatwoot_api_url &&
      org.chatwoot_api_token
    ) {
      try {
        const adminToken = secretStore.decrypt(org.chatwoot_api_token);
        const cw = new ChatwootClient(org.chatwoot_api_url, adminToken);
        await cw.toggleConversationStatus(
          org.chatwoot_account_id,
          conversation.chatwoot_conversation_id,
          "pending",
        );
      } catch (err) {
        logger.warn("Could not set Chatwoot conversation to pending before bot reply", {
          ...ctx,
          error: String(err),
        });
      }
    }

    const agentBotId =
      usedBotToken && org.chatwoot_agent_bot_id
        ? Number(org.chatwoot_agent_bot_id)
        : undefined;

    logger.info("Sending Chatwoot reply", { ...ctx, usedBotToken, agentBotConfigured, agentBotId });

    const sendParams = {
      apiUrl: org.chatwoot_api_url,
      apiToken: sendToken,
      accountId: org.chatwoot_account_id,
      conversationId: conversation.chatwoot_conversation_id,
      content: reply,
      agentBotId,
    };

    let sendResult = await messagingChannel.send(sendParams);

    if (
      !sendResult.ok &&
      sendResult.error.code === "UNAUTHORIZED" &&
      usedBotToken &&
      org.chatwoot_agent_bot_id &&
      org.chatwoot_api_token
    ) {
      const freshToken = await regenerateAndStoreBotToken(db, secretStore, orgId, {
        chatwoot_api_url: org.chatwoot_api_url,
        chatwoot_api_token: org.chatwoot_api_token,
        chatwoot_account_id: org.chatwoot_account_id,
        chatwoot_agent_bot_id: org.chatwoot_agent_bot_id,
      }, ctx);
      if (freshToken) {
        sendResult = await messagingChannel.send({ ...sendParams, apiToken: freshToken });
      }
    }

    if (!sendResult.ok) {
      logger.error("Send failed", { ...ctx, error: sendResult.error });
      await db
        .from("messages")
        .update({ status: "failed" })
        .eq("id", messageId);
      return;
    }

    await db.from("messages").insert({
      organization_id: orgId,
      conversation_id: conversationId,
      direction: "outbound",
      content: reply,
      external_message_id: `cw:${sendResult.value}`,
      status: "replied",
      ai_metadata: {
        inputTokens,
        outputTokens,
        cacheReadTokens: agentResult.value.cacheReadTokens,
        cacheCreationTokens: agentResult.value.cacheCreationTokens,
        sentAsBot: usedBotToken,
      },
      correlation_id: correlationId,
    });

    await db
      .from("messages")
      .update({ status: "replied" })
      .eq("id", messageId);

    await db
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    await incrementUsage(db, orgId, {
      messagesOut: 1,
      aiInputTokens: inputTokens,
      aiOutputTokens: outputTokens,
    });

    logger.info("Message processed successfully", { ...ctx, tokens: inputTokens + outputTokens });
    captureServerEvent("message_processed", {
      ...ctx,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    });
  } finally {
    await releaseConversationLock(db, conversationId);
  }
}
