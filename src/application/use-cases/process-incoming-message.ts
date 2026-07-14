import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentRunner, ToolRegistry, SecretStore } from "@/domain/ports";
import type { MessageId, ConversationId, ChannelType } from "@/domain/value-objects";
import { toOrgId, toCorrelationId, toContactId, toConversationId } from "@/domain/value-objects";
import { acquireConversationLock, releaseConversationLock } from "../services/conversation-lock";
import { getMonthlyUsage } from "../services/monthly-usage";
import { notifyQuotaExceeded } from "../services/quota-notification";
import { incrementUsage } from "../services/usage-tracker";
import { needsBillingSetup } from "@/lib/billing-setup";
import { isBotQueueStatus } from "@/lib/conversation-status";
import { QUOTA_HANDOFF_MESSAGE, resolveEnabledToolsForOrg } from "@/lib/plans";
import { handoffConversationToHuman } from "@/application/services/conversation-handoff";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";
import {
  reportAgentRunFailed,
  reportMessageSendFailed,
  reportPipelineAbort,
} from "@/lib/operational-telemetry";
import { getChannelAdapter, getOutboundFromId } from "@/infrastructure/adapters/channel-registry";
import { fetchAccountLabelTitles } from "@/application/services/conversation-labels";
import { fetchAccountAgents } from "@/application/services/conversation-assignment";

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
  const { db, agentRunner, toolRegistry, secretStore } = deps;
  const { orgId, conversationId, messageId, correlationId } = input;
  const ctx = { correlationId, orgId, conversationId };

  const locked = await acquireConversationLock(db, conversationId, correlationId);
  if (!locked) {
    logger.info("Conversation already locked, skipping", ctx);
    return;
  }

  try {
    const { data: org } = await db.from("organizations").select("*").eq("id", orgId).single();

    if (!org) {
      logger.warn("Org not found", ctx);
      return;
    }

    if (needsBillingSetup(org)) {
      reportPipelineAbort("billing_setup_incomplete", ctx);
      return;
    }

    const { data: conversation } = await db
      .from("conversations")
      .select("*, contacts(*), channels(*)")
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

    const channel = conversation.channels as {
      id: string;
      type: ChannelType;
      access_token: string | null;
      phone_number_id: string | null;
      ig_user_id: string | null;
      telegram_bot_id: string | null;
      status: string;
    } | null;

    if (!channel || channel.status !== "active" || !channel.access_token) {
      logger.warn("Conversation channel is inactive or missing token", ctx);
      return;
    }

    const subscriptionStatus = org.subscription_status ?? "trialing";
    if (!BILLING_ACTIVE_STATUSES.has(subscriptionStatus)) {
      reportPipelineAbort("subscription_inactive", { ...ctx, subscriptionStatus });
      return;
    }

    const messageQuota = org.message_quota ?? 500;
    const monthlyUsage = await getMonthlyUsage(db, orgId);

    let accessToken: string;
    try {
      accessToken = secretStore.decrypt(channel.access_token);
    } catch {
      reportPipelineAbort("channel_token_decrypt_failed", ctx, "error");
      await db.from("messages").update({ status: "failed" }).eq("id", messageId);
      return;
    }

    const adapter = getChannelAdapter(channel.type);
    const fromExternalId = getOutboundFromId(channel);
    const toExternalId = conversation.external_conversation_id as string | null;

    if (!fromExternalId || !toExternalId) {
      reportPipelineAbort("channel_missing_ids", ctx, "error");
      return;
    }

    if (monthlyUsage.messagesOut >= messageQuota) {
      await handoffConversationToHuman({
        db,
        orgId,
        conversationId,
        logContext: { ...ctx, trigger: "quota" },
      });

      await adapter.send({
        accessToken,
        fromExternalId,
        toExternalId,
        content: QUOTA_HANDOFF_MESSAGE,
      });

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
      messageType: (m.message_type ?? "text") as "text",
      attachments: (m.attachments ?? []) as never[],
      externalMessageId: m.external_message_id as string | null,
      senderUserId: (m.sender_user_id ?? null) as never,
      isInternalNote: Boolean(m.is_internal_note),
      status: m.status as "received" | "processing" | "replied" | "failed",
      aiMetadata: m.ai_metadata as Record<string, unknown> | null,
      correlationId: m.correlation_id ? toCorrelationId(m.correlation_id as string) : null,
      createdAt: new Date(m.created_at as string),
    }));

    const hasKbDocuments = await orgHasReadyKbDocuments(db, orgId);
    const enabledToolNames = resolveEnabledToolsForOrg({
      ...org,
      hasKbDocuments,
      hasActiveChannel: true,
    });
    const tools = toolRegistry.getToolsForOrg(toOrgId(orgId), enabledToolNames);

    const availableLabels = await fetchAccountLabelTitles({ db, orgId }).catch(() => [] as string[]);
    const availableAgents = await fetchAccountAgents({ db, orgId }).catch(() => [] as never[]);

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

    const toolContext = {
      orgId: toOrgId(orgId),
      conversationId: toConversationId(conversationId),
      contactId: toContactId(conversation.contact_id as string),
      contactPhone: (conversation.contacts?.phone as string) ?? null,
      calendar: calendarCtx,
      stripe: stripeCtx,
      messaging: {
        channelType: channel.type,
        accessToken,
        fromExternalId,
        toExternalId,
      },
    };

    logger.info("Running agent", {
      ...ctx,
      toolCount: tools.length,
      toolNames: tools.map((t) => t.name),
      channelType: channel.type,
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
      availableLabels,
      availableAgents: availableAgents.map((a) => ({ name: a.name, email: a.email })),
    });

    if (!agentResult.ok) {
      reportAgentRunFailed(ctx, agentResult.error, org.model);
      await db.from("messages").update({ status: "failed" }).eq("id", messageId);
      return;
    }

    const { reply, inputTokens, outputTokens } = agentResult.value;

    if (!reply || reply.trim().length === 0) {
      reportPipelineAbort("empty_reply", ctx);
      return;
    }

    const sendResult = await adapter.send({
      accessToken,
      fromExternalId,
      toExternalId,
      content: reply,
    });

    if (!sendResult.ok) {
      reportMessageSendFailed(ctx, sendResult.error);
      await db.from("messages").update({ status: "failed" }).eq("id", messageId);
      return;
    }

    await db.from("messages").insert({
      organization_id: orgId,
      conversation_id: conversationId,
      direction: "outbound",
      content: reply,
      message_type: "text",
      external_message_id: `${channel.type}:${sendResult.value}`,
      status: "replied",
      ai_metadata: {
        inputTokens,
        outputTokens,
        cacheReadTokens: agentResult.value.cacheReadTokens,
        cacheCreationTokens: agentResult.value.cacheCreationTokens,
      },
      correlation_id: correlationId,
    });

    await db.from("messages").update({ status: "replied" }).eq("id", messageId);

    await db
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    await incrementUsage(db, orgId, {
      messagesOut: 1,
      aiInputTokens: inputTokens,
      aiOutputTokens: outputTokens,
    });

    logger.info("Message processed successfully", {
      ...ctx,
      tokens: inputTokens + outputTokens,
    });
    captureServerEvent("message_processed", {
      ...ctx,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    });
  } finally {
    await releaseConversationLock(db, conversationId);
  }
}
