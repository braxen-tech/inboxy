"use server";

import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { revalidatePath } from "next/cache";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";
import { normalizeFollowupIdleMinutes } from "@/lib/followup-idle-options";

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

  const { error } = await db
    .from("organizations")
    .update(updatePayload)
    .eq("id", orgId);

  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/agent`);
  return { success: true };
}
