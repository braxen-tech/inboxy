"use server";

import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { revalidatePath } from "next/cache";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

export async function updateAgentSettings(
  orgId: string,
  orgSlug: string,
  settings: { systemPrompt: string; model: string },
) {
  scheduleTelemetryFlush();
  const db = getAdminClient();
  const { error } = await db
    .from("organizations")
    .update({
      system_prompt: settings.systemPrompt,
      model: settings.model,
    })
    .eq("id", orgId);

  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/agent`);
  return { success: true };
}
