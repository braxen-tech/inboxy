import { Resend } from "resend";
import { logger } from "@/lib/logger";

let client: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export async function sendEmail(input: { to: string; subject: string; html: string }): Promise<void> {
  const resend = getClient();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!resend || !from) {
    logger.warn("sendEmail: RESEND_API_KEY or RESEND_FROM_EMAIL not configured, skipping", { to: input.to });
    return;
  }

  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  if (error) {
    logger.error("sendEmail failed", { to: input.to, error: error.message });
  }
}
