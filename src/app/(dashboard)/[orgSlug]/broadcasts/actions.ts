"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { getOrgBySlug } from "@/lib/get-org";
import { sendBroadcast } from "@/application/use-cases/send-broadcast";

const createBroadcastSchema = z.object({
  orgSlug: z.string().min(1),
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1).max(50000),
});

export async function createAndSendBroadcast(formData: FormData) {
  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const raw = Object.fromEntries(formData.entries());
  const parsed = createBroadcastSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos. Verifique os campos." };

  const { orgSlug, subject, bodyHtml } = parsed.data;

  const org = await getOrgBySlug(orgSlug);
  if (!org || org.owner_user_id !== user.id) return { error: "Organização não encontrada." };

  const db = getAdminClient();

  const { data: broadcast, error: insertError } = await db
    .from("email_broadcasts")
    .insert({
      organization_id: org.id,
      subject,
      body_html: bodyHtml,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertError || !broadcast) return { error: "Erro ao criar broadcast." };

  try {
    const result = await sendBroadcast(db, broadcast.id, org.id);
    revalidatePath(`/${orgSlug}/broadcasts`);
    return { success: true, sent: result.sent, failed: result.failed };
  } catch {
    return { error: "Erro ao enviar emails." };
  }
}
