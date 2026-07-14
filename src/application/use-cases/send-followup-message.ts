import type { SupabaseClient } from "@supabase/supabase-js";
import type { SecretStore } from "@/domain/ports";
import type { ConversationId, MessageId, ChannelType } from "@/domain/value-objects";
import { toOrgId, toCorrelationId } from "@/domain/value-objects";
import { acquireConversationLock, releaseConversationLock } from "../services/conversation-lock";
import { getMonthlyUsage } from "../services/monthly-usage";
import { incrementUsage } from "../services/usage-tracker";
import { generateNudgeReply } from "../services/generate-nudge-reply";
import { needsBillingSetup } from "@/lib/billing-setup";
import { isBotQueueStatus } from "@/lib/conversation-status";
import { getChannelAdapter, getOutboundFromId } from "@/infrastructure/adapters/channel-registry";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";
import { randomUUID } from "node:crypto";

const BILLING_ACTIVE_STATUSES = new Set(["active", "trialing"]);
const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

export type FollowupType = "silent_nudge" | "manual";

interface SendFollowupInput {
  orgId: string;
  conversationId: string;
  followupType: FollowupType;
  scheduledFollowupId?: string;
  reason?: string;
}

interface Deps {
  db: SupabaseClient;
  secretStore: SecretStore;
}

async function conversationAlreadyNudged(
  db: SupabaseClient,
  conversationId: string,
  followupType: FollowupType,
): Promise<boolean> {
  const { count, error } = await db
    .from("scheduled_followups")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("type", followupType)
    .in("status", ["sent", "pending"]);

  if (error) {
    logger.warn("Failed to check existing follow-up", { conversationId, error: error.message });
    return true;
  }

  return (count ?? 0) > 0;
}

async function lastMessageIsOutbound(db: SupabaseClient, conversationId: string): Promise<boolean> {
  const { data } = await db
    .from("messages")
    .select("direction")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.direction === "outbound";
}

export async function sendFollowupMessage(deps: Deps, input: SendFollowupInput): Promise<void> {
  const { db, secretStore } = deps;
  const correlationId = randomUUID();
  const ctx = {
    correlationId,
    orgId: input.orgId,
    conversationId: input.conversationId,
    followupType: input.followupType,
  };

  const locked = await acquireConversationLock(db, input.conversationId, correlationId);
  if (!locked) {
    logger.info("Follow-up skipped: conversation locked", ctx);
    return;
  }

  try {
    const { data: org } = await db.from("organizations").select("*").eq("id", input.orgId).single();

    if (!org?.followup_enabled) return;

    if (needsBillingSetup(org)) return;

    const subscriptionStatus = org.subscription_status ?? "trialing";
    if (!BILLING_ACTIVE_STATUSES.has(subscriptionStatus)) return;

    const messageQuota = org.message_quota ?? 500;
    const monthlyUsage = await getMonthlyUsage(db, input.orgId);
    if (monthlyUsage.messagesOut >= messageQuota) {
      logger.info("Follow-up skipped: quota exceeded", ctx);
      return;
    }

    const { data: conversation } = await db
      .from("conversations")
      .select("*, channels(*)")
      .eq("id", input.conversationId)
      .eq("organization_id", input.orgId)
      .single();

    if (!conversation || !isBotQueueStatus(conversation.status)) {
      if (input.scheduledFollowupId) {
        await db
          .from("scheduled_followups")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", input.scheduledFollowupId)
          .eq("status", "pending");
      }
      return;
    }

    const channel = conversation.channels as {
      id: string;
      type: ChannelType;
      status: string;
      access_token: string | null;
      phone_number_id: string | null;
      ig_user_id: string | null;
      telegram_bot_id: string | null;
    } | null;

    if (!channel || channel.status !== "active" || !channel.access_token) return;

    if (!conversation.last_inbound_at) return;

    const lastInboundMs = new Date(conversation.last_inbound_at).getTime();
    // Meta customer-care window; Telegram has no equivalent restriction.
    if (channel.type !== "telegram" && Date.now() - lastInboundMs > WHATSAPP_WINDOW_MS) {
      logger.info("Follow-up skipped: outside 24h window", ctx);
      if (input.scheduledFollowupId) {
        await db
          .from("scheduled_followups")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", input.scheduledFollowupId)
          .eq("status", "pending");
      }
      return;
    }

    if (input.followupType === "silent_nudge") {
      const idleMs = (org.followup_idle_minutes ?? 60) * 60 * 1000;
      if (Date.now() - lastInboundMs < idleMs) return;
      if (!(await lastMessageIsOutbound(db, input.conversationId))) return;
      if (await conversationAlreadyNudged(db, input.conversationId, "silent_nudge")) return;
    }

    const { data: messages } = await db
      .from("messages")
      .select("*")
      .eq("conversation_id", input.conversationId)
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
      senderUserId: null as never,
      isInternalNote: Boolean(m.is_internal_note),
      status: m.status as "received" | "processing" | "replied" | "failed",
      aiMetadata: m.ai_metadata as Record<string, unknown> | null,
      correlationId: m.correlation_id ? toCorrelationId(m.correlation_id as string) : null,
      createdAt: new Date(m.created_at as string),
    }));

    const nudgeResult = await generateNudgeReply({
      systemPrompt: org.system_prompt,
      knowledgeBase: org.knowledge_base,
      history,
      model: org.model,
      language: org.language,
      orgId: input.orgId,
      conversationId: input.conversationId,
      reason: input.reason,
    });

    if (!nudgeResult.ok) {
      logger.error("Follow-up nudge generation failed", { ...ctx, error: nudgeResult.error.message });
      if (input.scheduledFollowupId) {
        await db
          .from("scheduled_followups")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", input.scheduledFollowupId)
          .eq("status", "pending");
      }
      return;
    }

    const reply = nudgeResult.value.reply.trim();
    if (!reply) return;

    let accessToken: string;
    try {
      accessToken = secretStore.decrypt(channel.access_token);
    } catch {
      logger.error("Follow-up: cannot decrypt channel token", ctx);
      return;
    }

    const fromExternalId = getOutboundFromId(channel);
    const toExternalId = conversation.external_conversation_id as string | null;
    if (!fromExternalId || !toExternalId) return;

    const adapter = getChannelAdapter(channel.type);
    const sendResult = await adapter.send({
      accessToken,
      fromExternalId,
      toExternalId,
      content: reply,
    });

    if (!sendResult.ok) {
      logger.error("Follow-up send failed", { ...ctx, error: sendResult.error.message });
      if (input.scheduledFollowupId) {
        await db
          .from("scheduled_followups")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", input.scheduledFollowupId)
          .eq("status", "pending");
      }
      return;
    }

    await db.from("messages").insert({
      organization_id: input.orgId,
      conversation_id: input.conversationId,
      direction: "outbound",
      content: reply,
      message_type: "text",
      external_message_id: `${channel.type}:${sendResult.value}`,
      status: "replied",
      ai_metadata: {
        inputTokens: nudgeResult.value.inputTokens,
        outputTokens: nudgeResult.value.outputTokens,
        followupType: input.followupType,
      },
      correlation_id: correlationId,
    });

    await db
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", input.conversationId);

    const now = new Date().toISOString();

    if (input.scheduledFollowupId) {
      await db
        .from("scheduled_followups")
        .update({
          status: "sent",
          sent_at: now,
          message_content: reply,
          correlation_id: correlationId,
          updated_at: now,
        })
        .eq("id", input.scheduledFollowupId);
    } else {
      await db.from("scheduled_followups").insert({
        organization_id: input.orgId,
        conversation_id: input.conversationId,
        type: input.followupType,
        scheduled_at: now,
        status: "sent",
        message_content: reply,
        sent_at: now,
        correlation_id: correlationId,
      });
    }

    await incrementUsage(db, input.orgId, {
      messagesOut: 1,
      aiInputTokens: nudgeResult.value.inputTokens,
      aiOutputTokens: nudgeResult.value.outputTokens,
    });

    logger.info("Follow-up sent", ctx);
    captureServerEvent("followup_sent", { ...ctx, followup_type: input.followupType });
  } finally {
    await releaseConversationLock(db, input.conversationId);
  }
}
