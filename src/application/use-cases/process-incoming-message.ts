import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentRunner, MessagingChannel, ToolRegistry } from "@/domain/ports";
import type { SecretStore } from "@/domain/ports";
import type { MessageId, ConversationId } from "@/domain/value-objects";
import { toOrgId, toCorrelationId } from "@/domain/value-objects";
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

    if (!org || org.chatwoot_status !== "active") {
      logger.warn("Org not found or Chatwoot disconnected", ctx);
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

    const enabledToolNames = [...(org.tools_enabled ?? [])];
    if (org.cal_status === "active" && org.cal_api_key && org.cal_event_type_id) {
      const calToolNames = ["check_calendar_availability", "book_calendar_appointment"];
      for (const name of calToolNames) {
        if (!enabledToolNames.includes(name)) enabledToolNames.push(name);
      }
    }
    if (org.stripe_status === "active" && org.stripe_secret_key) {
      const stripeToolNames = [
        "search_products", "get_product_details", "show_product_images",
        "add_to_cart", "view_cart", "remove_from_cart", "create_checkout",
      ];
      for (const name of stripeToolNames) {
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

    let stripeCtx: import("@/domain/ports").StripeContext | undefined;
    if (org.stripe_status === "active" && org.stripe_secret_key) {
      stripeCtx = { apiKey: secretStore.decrypt(org.stripe_secret_key) };
    }

    let chatwootCtx: import("@/domain/ports").ChatwootContext | undefined;
    if (org.chatwoot_status === "active" && org.chatwoot_api_token) {
      chatwootCtx = {
        apiUrl: org.chatwoot_api_url,
        apiToken: secretStore.decrypt(org.chatwoot_api_token),
        accountId: org.chatwoot_account_id,
        conversationId: conversation.chatwoot_conversation_id,
      };
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

    let apiToken: string;
    try {
      apiToken = secretStore.decrypt(org.chatwoot_api_token);
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

    const sendResult = await messagingChannel.send({
      apiUrl: org.chatwoot_api_url,
      apiToken,
      accountId: org.chatwoot_account_id,
      conversationId: conversation.chatwoot_conversation_id,
      content: reply,
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
      external_message_id: `cw:${sendResult.value}`,
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
