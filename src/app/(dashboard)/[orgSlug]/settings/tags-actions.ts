"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";

type Role = "admin" | "agent" | "viewer";

async function requireAdmin(orgSlug: string) {
  const supabase = await getServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." as const };

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) return { error: "Organização não encontrada." as const };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || (membership.role as Role) !== "admin") {
    return { error: "Somente administradores podem gerenciar tags." as const };
  }

  return { supabase, user, org };
}

const createSchema = z.object({
  orgSlug: z.string().min(1),
  name: z.string().min(1).max(64),
  color: z.string().max(32).optional(),
});

export async function createTag(raw: z.infer<typeof createSchema>) {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requireAdmin(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, org } = ctx;

  const { data, error } = await supabase
    .from("tags")
    .insert({
      organization_id: org.id,
      name: parsed.data.name.trim(),
      color: parsed.data.color ?? "#6366f1",
    })
    .select("id, name, color")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Já existe uma tag com esse nome." };
    return { error: error.message };
  }

  revalidatePath(`/${parsed.data.orgSlug}/settings`);
  revalidatePath(`/${parsed.data.orgSlug}/leads`);
  revalidatePath(`/${parsed.data.orgSlug}/agent`);
  return { success: true as const, tag: data };
}

const updateSchema = z.object({
  orgSlug: z.string().min(1),
  tagId: z.string().uuid(),
  name: z.string().min(1).max(64).optional(),
  color: z.string().max(32).optional(),
});

export async function updateTag(raw: z.infer<typeof updateSchema>) {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requireAdmin(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, org } = ctx;

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
  if (parsed.data.color !== undefined) patch.color = parsed.data.color;

  const { error } = await supabase
    .from("tags")
    .update(patch)
    .eq("id", parsed.data.tagId)
    .eq("organization_id", org.id);

  if (error) {
    if (error.code === "23505") return { error: "Já existe uma tag com esse nome." };
    return { error: error.message };
  }

  revalidatePath(`/${parsed.data.orgSlug}/settings`);
  revalidatePath(`/${parsed.data.orgSlug}/leads`);
  revalidatePath(`/${parsed.data.orgSlug}/agent`);
  return { success: true as const };
}

const deleteSchema = z.object({
  orgSlug: z.string().min(1),
  tagId: z.string().uuid(),
});

export async function deleteTag(raw: z.infer<typeof deleteSchema>) {
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requireAdmin(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, org } = ctx;

  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("id", parsed.data.tagId)
    .eq("organization_id", org.id);

  if (error) return { error: error.message };

  revalidatePath(`/${parsed.data.orgSlug}/settings`);
  revalidatePath(`/${parsed.data.orgSlug}/leads`);
  revalidatePath(`/${parsed.data.orgSlug}/agent`);
  return { success: true as const };
}
