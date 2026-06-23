import type { SupabaseClient } from "@supabase/supabase-js";
import type { MessagingChannel, SecretStore } from "@/domain/ports";
import { sendFollowupMessage } from "./send-followup-message";
import { isBotQueueStatus } from "@/lib/conversation-status";
import { logger } from "@/lib/logger";

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 50;

interface Deps {
  db: SupabaseClient;
  messagingChannel: MessagingChannel;
  secretStore: SecretStore;
}

async function conversationHasSentOrPendingNudge(
  db: SupabaseClient,
  conversationId: string,
): Promise<boolean> {
  const { count } = await db
    .from("scheduled_followups")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("type", "silent_nudge")
    .in("status", ["sent", "pending"]);

  return (count ?? 0) > 0;
}

async function lastMessageIsOutbound(
  db: SupabaseClient,
  conversationId: string,
): Promise<boolean> {
  const { data } = await db
    .from("messages")
    .select("direction")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.direction === "outbound";
}

export async function dispatchFollowups(deps: Deps): Promise<void> {
  const { db } = deps;
  const now = Date.now();
  const windowStart = new Date(now - WHATSAPP_WINDOW_MS).toISOString();

  const { data: orgs } = await db
    .from("organizations")
    .select("id, followup_idle_minutes")
    .eq("followup_enabled", true)
    .eq("chatwoot_status", "active");

  for (const org of orgs ?? []) {
    const idleMinutes = org.followup_idle_minutes ?? 60;
    const idleCutoff = new Date(now - idleMinutes * 60 * 1000).toISOString();

    const { data: conversations } = await db
      .from("conversations")
      .select("id")
      .eq("organization_id", org.id)
      .eq("status", "pending")
      .lt("last_inbound_at", idleCutoff)
      .gt("last_inbound_at", windowStart)
      .limit(BATCH_LIMIT);

    for (const conversation of conversations ?? []) {
      if (await conversationHasSentOrPendingNudge(db, conversation.id)) {
        continue;
      }

      if (!(await lastMessageIsOutbound(db, conversation.id))) {
        continue;
      }

      await sendFollowupMessage(deps, {
        orgId: org.id,
        conversationId: conversation.id,
        followupType: "silent_nudge",
      });
    }
  }

  const { data: manualFollowups } = await db
    .from("scheduled_followups")
    .select("id, organization_id, conversation_id, metadata")
    .eq("type", "manual")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .limit(BATCH_LIMIT);

  for (const followup of manualFollowups ?? []) {
    const { data: conversation } = await db
      .from("conversations")
      .select("status")
      .eq("id", followup.conversation_id)
      .maybeSingle();

    if (!conversation || !isBotQueueStatus(conversation.status)) {
      await db
        .from("scheduled_followups")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", followup.id)
        .eq("status", "pending");
      continue;
    }

    const reason =
      typeof followup.metadata === "object" &&
      followup.metadata !== null &&
      "reason" in followup.metadata &&
      typeof (followup.metadata as { reason?: unknown }).reason === "string"
        ? (followup.metadata as { reason: string }).reason
        : undefined;

    await sendFollowupMessage(deps, {
      orgId: followup.organization_id,
      conversationId: followup.conversation_id,
      followupType: "manual",
      scheduledFollowupId: followup.id,
      reason,
    });
  }

  logger.info("Follow-up dispatch completed", {
    orgCount: orgs?.length ?? 0,
    manualCount: manualFollowups?.length ?? 0,
  });
}
