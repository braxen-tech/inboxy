import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentRunner, MessagingChannel, ToolRegistry } from "@/domain/ports";
import type { SecretStore } from "@/domain/ports";
import type { OrgId, ConversationId, MessageId, CorrelationId } from "@/domain/value-objects";
import { toOrgId, toPhoneNumber, toCorrelationId } from "@/domain/value-objects";
import { acquireConversationLock, releaseConversationLock } from "../services/conversation-lock";
import { incrementUsage } from "../services/usage-tracker";
import { logger } from "@/lib/logger";

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

    if (!org || org.whatsapp_status !== "active") {
      logger.warn("Org not found or WhatsApp disconnected", ctx);
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

    if (conversation.status === "human") {
      logger.info("Conversation in human mode, bot skipping", ctx);
      return;
    }

    const { data: messages } = await db
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const history = (messages ?? []).map((m: Record<string, unknown>) => ({
      id: m.id as MessageId,
      organizationId: toOrgId(m.organization_id as string),
      conversationId: m.conversation_id as ConversationId,
      direction: m.direction as "inbound" | "outbound",
      content: m.content as string,
      whatsappMessageId: m.whatsapp_message_id as string | null,
      status: m.status as "received" | "processing" | "replied" | "failed",
      aiMetadata: m.ai_metadata as Record<string, unknown> | null,
      correlationId: m.correlation_id ? toCorrelationId(m.correlation_id as string) : null,
      createdAt: new Date(m.created_at as string),
    }));

    // Derive enabled tool names from org config.
    // Cal.com tools are always enabled when cal is active — avoids state drift
    // between tools_enabled and cal_status.
    const enabledToolNames = [...(org.tools_enabled ?? [])];
    if (org.cal_status === "active" && org.cal_api_key && org.cal_event_type_id) {
      const calToolNames = ["check_calendar_availability", "book_calendar_appointment"];
      for (const name of calToolNames) {
        if (!enabledToolNames.includes(name)) enabledToolNames.push(name);
      }
    }

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

    const toolContext = {
      orgId: toOrgId(orgId),
      contactPhone: conversation.contacts.phone,
      conversationId,
      calendar: calendarCtx,
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

    let accessToken: string;
    try {
      accessToken = secretStore.decrypt(org.whatsapp_access_token);
    } catch {
      logger.error(
        "Cannot decrypt WhatsApp access token — reconnect Integrações (ENCRYPTION_KEY may have changed)",
        ctx,
      );
      await db
        .from("messages")
        .update({ status: "failed" })
        .eq("id", messageId);
      return;
    }

    const sendResult = await messagingChannel.send({
      orgId: toOrgId(orgId),
      to: toPhoneNumber(conversation.contacts.phone),
      content: reply,
      phoneNumberId: org.whatsapp_phone_number_id,
      accessToken,
    });

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
      whatsapp_message_id: sendResult.value,
      status: "replied",
      ai_metadata: {
        inputTokens,
        outputTokens,
        cacheReadTokens: agentResult.value.cacheReadTokens,
        cacheCreationTokens: agentResult.value.cacheCreationTokens,
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
  } finally {
    await releaseConversationLock(db, conversationId);
  }
}
