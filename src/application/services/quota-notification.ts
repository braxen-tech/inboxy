import type { SupabaseClient } from "@supabase/supabase-js";
import { QUOTA_WARNING_RATIO } from "@/lib/plans";
import { logger } from "@/lib/logger";

export async function notifyQuotaExceeded(
  db: SupabaseClient,
  orgId: string,
  ownerUserId: string,
  usage: { messagesOut: number; quota: number },
): Promise<void> {
  logger.warn("Message quota exceeded", {
    orgId,
    ownerUserId,
    messagesOut: usage.messagesOut,
    quota: usage.quota,
  });

  await db.from("audit_log").insert({
    organization_id: orgId,
    user_id: ownerUserId,
    action: "billing.quota_exceeded",
    details: {
      messages_out: usage.messagesOut,
      message_quota: usage.quota,
    },
  });
}

export async function notifyQuotaWarning(
  db: SupabaseClient,
  orgId: string,
  ownerUserId: string,
  usage: { messagesOut: number; quota: number },
): Promise<void> {
  const ratio = usage.quota > 0 ? usage.messagesOut / usage.quota : 0;
  if (ratio < QUOTA_WARNING_RATIO) return;

  logger.info("Message quota warning threshold", {
    orgId,
    ownerUserId,
    messagesOut: usage.messagesOut,
    quota: usage.quota,
    ratio,
  });

  await db.from("audit_log").insert({
    organization_id: orgId,
    user_id: ownerUserId,
    action: "billing.quota_warning",
    details: {
      messages_out: usage.messagesOut,
      message_quota: usage.quota,
      ratio,
    },
  });
}
