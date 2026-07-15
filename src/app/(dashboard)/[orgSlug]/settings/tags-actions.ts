"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { requireOrgCapability } from "@/lib/authz";

const createSchema = z.object({
  orgSlug: z.string().min(1),
  name: z.string().min(1).max(64),
  color: z.string().max(32).optional(),
});

export async function createTag(raw: z.infer<typeof createSchema>) {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requireOrgCapability(parsed.data.orgSlug, "manage_tags");
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

  const ctx = await requireOrgCapability(parsed.data.orgSlug, "manage_tags");
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

  const ctx = await requireOrgCapability(parsed.data.orgSlug, "manage_tags");
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
