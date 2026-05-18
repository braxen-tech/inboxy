"use server";

import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { revalidatePath } from "next/cache";

export async function updateAgentSettings(
  orgId: string,
  orgSlug: string,
  settings: { systemPrompt: string; model: string },
) {
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
