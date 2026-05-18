"use server";

import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { revalidatePath } from "next/cache";

export async function updateKnowledgeBase(orgId: string, orgSlug: string, knowledgeBase: string) {
  const MAX_KB_CHARS = 200_000;
  if (knowledgeBase.length > MAX_KB_CHARS) {
    return { error: `Knowledge base excede o limite de ${MAX_KB_CHARS} caracteres.` };
  }

  const db = getAdminClient();
  const { error } = await db
    .from("organizations")
    .update({ knowledge_base: knowledgeBase })
    .eq("id", orgId);

  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/kb`);
  return { success: true };
}
