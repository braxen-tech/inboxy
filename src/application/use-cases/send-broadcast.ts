import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/send-email";
import { logger } from "@/lib/logger";

const BATCH_SIZE = 50;

export async function sendBroadcast(
  db: SupabaseClient,
  broadcastId: string,
  organizationId: string,
): Promise<{ sent: number; failed: number }> {
  await db
    .from("email_broadcasts")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", broadcastId)
    .eq("organization_id", organizationId);

  const { data: broadcast } = await db
    .from("email_broadcasts")
    .select("subject, body_html")
    .eq("id", broadcastId)
    .single();

  if (!broadcast) {
    throw new Error("Broadcast not found");
  }

  const { data: recipients } = await db
    .from("users")
    .select("email")
    .eq("organization_id", organizationId)
    .eq("role", "end_user")
    .not("email", "is", null);

  if (!recipients || recipients.length === 0) {
    await db
      .from("email_broadcasts")
      .update({ status: "sent", sent_at: new Date().toISOString(), recipient_count: 0, updated_at: new Date().toISOString() })
      .eq("id", broadcastId);
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((r) =>
        sendEmail({
          to: r.email!,
          subject: broadcast.subject,
          html: broadcast.body_html,
        }),
      ),
    );

    for (const result of results) {
      if (result.status === "fulfilled") sent++;
      else failed++;
    }
  }

  await db
    .from("email_broadcasts")
    .update({
      status: failed === recipients.length ? "failed" : "sent",
      sent_at: new Date().toISOString(),
      recipient_count: sent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", broadcastId);

  logger.info("Broadcast sent", { broadcastId, sent, failed });
  return { sent, failed };
}
