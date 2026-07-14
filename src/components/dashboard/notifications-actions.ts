"use server";

import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";

export async function markNotificationsRead(ids: string[]): Promise<{ success: true } | { error: string }> {
  if (ids.length === 0) return { success: true };
  const supabase = await getServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { success: true };
}
