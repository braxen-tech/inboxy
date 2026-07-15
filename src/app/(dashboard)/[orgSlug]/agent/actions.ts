"use server";

import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { revalidatePath } from "next/cache";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";
import { normalizeFollowupIdleMinutes } from "@/lib/followup-idle-options";
import { requireOrgCapability } from "@/lib/authz-server";

export async function updateAgentSettings(
  orgId: string,
  orgSlug: string,
  settings: {
    systemPrompt: string;
    followupEnabled?: boolean;
    followupIdleMinutes?: number;
  },
) {
  scheduleTelemetryFlush();

  const ctx = await requireOrgCapability(orgSlug, "manage_agent");
  if ("error" in ctx) return { error: ctx.error };
  if (ctx.org.id !== orgId) return { error: "Organização inválida." };

  const db = getAdminClient();

  const updatePayload: Record<string, unknown> = {
    system_prompt: settings.systemPrompt,
  };

  if (settings.followupEnabled !== undefined) {
    updatePayload.followup_enabled = settings.followupEnabled;
  }

  if (settings.followupIdleMinutes !== undefined) {
    updatePayload.followup_idle_minutes = normalizeFollowupIdleMinutes(settings.followupIdleMinutes);
  }

  const { error } = await db.from("organizations").update(updatePayload).eq("id", orgId);

  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/agent`);
  return { success: true };
}
