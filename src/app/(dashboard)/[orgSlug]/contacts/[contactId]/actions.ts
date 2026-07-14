"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";

const schema = z.object({
  orgSlug: z.string().min(1),
  contactId: z.string().uuid(),
  name: z.string().max(200).optional().default(""),
  email: z.string().email().or(z.literal("")).optional().default(""),
  phone: z.string().max(64).optional().default(""),
  ig_username: z.string().max(64).optional().default(""),
  notes: z.string().max(4000).optional().default(""),
});

export async function updateContact(raw: z.infer<typeof schema>) {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await getServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", parsed.data.orgSlug)
    .maybeSingle();
  if (!org) return { error: "Organização não encontrada." };

  const { error } = await supabase
    .from("contacts")
    .update({
      name: parsed.data.name || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      ig_username: parsed.data.ig_username || null,
      notes: parsed.data.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.contactId)
    .eq("organization_id", org.id);

  if (error) return { error: error.message };

  await supabase.from("activities").insert({
    organization_id: org.id,
    entity_type: "contact",
    entity_id: parsed.data.contactId,
    user_id: user.id,
    type: "updated",
    content: "Contato atualizado",
  });

  revalidatePath(`/${parsed.data.orgSlug}/contacts/${parsed.data.contactId}`);
  return { success: true as const };
}
