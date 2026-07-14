import type { SupabaseClient } from "@supabase/supabase-js";
import { getFromAddress, getResendClient } from "@/infrastructure/adapters/resend/client";
import { logger } from "@/lib/logger";

export type NotificationType =
  | "new_message"
  | "assigned"
  | "mention"
  | "lead_stage_changed"
  | "invite"
  | "system"
  | "quota_warning"
  | "quota_exceeded";

export interface NotifyUserInput {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Optional deep link path within the app (relative). */
  actionUrl?: string;
  entityType?: "lead" | "contact" | "conversation" | "organization";
  entityId?: string;
  /** Extra metadata stored on the notification row. */
  metadata?: Record<string, unknown>;
  /** If true, also emails the user via Resend (requires RESEND_API_KEY). */
  email?: boolean;
}

/**
 * Persists an in-app notification row and (optionally) sends an email via Resend.
 * Never throws — logs failures and returns a flag so callers can react.
 */
export async function notifyUser(
  db: SupabaseClient,
  input: NotifyUserInput,
): Promise<{ inserted: boolean; emailed: boolean }> {
  const { error } = await db.from("notifications").insert({
    organization_id: input.organizationId,
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    action_url: input.actionUrl ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    logger.warn("Failed to insert notification", { error: error.message, ...input });
    return { inserted: false, emailed: false };
  }

  if (!input.email) return { inserted: true, emailed: false };

  const resend = getResendClient();
  if (!resend) return { inserted: true, emailed: false };

  const { data: profile } = await db
    .from("user_profiles")
    .select("email, name")
    .eq("id", input.userId)
    .maybeSingle();

  if (!profile?.email) {
    logger.info("Skipping email — user has no address", { userId: input.userId });
    return { inserted: true, emailed: false };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.inboxy.app";
  const actionHref = input.actionUrl ? `${appUrl}${input.actionUrl}` : appUrl;

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to: profile.email,
      subject: input.title,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px;">
          <h2 style="margin: 0 0 12px;">${escapeHtml(input.title)}</h2>
          <p style="white-space: pre-wrap; color: #333;">${escapeHtml(input.body)}</p>
          <p style="margin-top: 20px;">
            <a href="${actionHref}" style="background: #2563eb; color: white; padding: 10px 16px; border-radius: 6px; text-decoration: none;">Abrir no Inboxy</a>
          </p>
        </div>
      `,
    });
    return { inserted: true, emailed: true };
  } catch (err) {
    logger.warn("Resend email failed", { error: String(err), userId: input.userId });
    return { inserted: true, emailed: false };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
