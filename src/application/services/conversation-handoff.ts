import type { SupabaseClient } from "@supabase/supabase-js";
import { ChatwootClient } from "@/infrastructure/adapters/chatwoot/client";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";

export interface HandoffToHumanParams {
  db: SupabaseClient;
  orgId: string;
  conversationId: string;
  chatwoot?: {
    apiUrl: string;
    /** Admin/user token — unassign + fallback toggle */
    adminToken: string;
    /** Agent bot token — preferred for pending→open (bot_handoff) */
    botToken?: string | null;
    accountId: string;
    conversationId: number;
  };
  logContext?: Record<string, string>;
}

export async function handoffConversationToHuman(
  params: HandoffToHumanParams,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { db, orgId, conversationId, chatwoot, logContext = {} } = params;

  const { error: dbError } = await db
    .from("conversations")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("organization_id", orgId);

  if (dbError) {
    logger.error("Handoff: failed to update conversation status", {
      ...logContext,
      error: dbError.message,
    });
    return { ok: false, error: dbError.message };
  }

  if (chatwoot) {
    const adminClient = new ChatwootClient(chatwoot.apiUrl, chatwoot.adminToken);

    let opened = false;
    if (chatwoot.botToken) {
      const botClient = new ChatwootClient(chatwoot.apiUrl, chatwoot.botToken);
      const botToggle = await botClient.toggleConversationStatus(
        chatwoot.accountId,
        chatwoot.conversationId,
        "open",
      );
      if (botToggle.ok) {
        opened = true;
        logger.info("Handoff: Chatwoot open via bot toggle_status", logContext);
      } else {
        logger.warn("Handoff: bot toggle_status failed, trying admin", {
          ...logContext,
          error: botToggle.error,
        });
      }
    }

    if (!opened) {
      const adminToggle = await adminClient.toggleConversationStatus(
        chatwoot.accountId,
        chatwoot.conversationId,
        "open",
      );
      if (!adminToggle.ok) {
        logger.warn("Handoff: failed to set Chatwoot open", {
          ...logContext,
          error: adminToggle.error,
        });
        return { ok: false, error: adminToggle.error };
      }
    }

    const unassign = await adminClient.unassignConversation(
      chatwoot.accountId,
      chatwoot.conversationId,
    );
    if (!unassign.ok) {
      logger.warn("Handoff: failed to unassign conversation (may still show under Mine)", {
        ...logContext,
        error: unassign.error,
      });
    }
  }

  logger.info("Conversation handed off to human", logContext);
  captureServerEvent("human_handoff", {
    orgId,
    conversationId,
    trigger: logContext.trigger,
  });
  return { ok: true };
}
