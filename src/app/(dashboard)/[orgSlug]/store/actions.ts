"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";

async function getOrgForOwner(orgSlug: string) {
  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." as const };

  const { data: org } = await supabase
    .from("organizations")
    .select("id, slug")
    .eq("slug", orgSlug)
    .maybeSingle();

  if (!org) return { error: "Organização não encontrada." as const };
  return { org, supabase };
}

// --- Profile ---

const profileSchema = z.object({
  orgSlug: z.string().min(1),
  displayName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  photoUrl: z.string().url().max(2048).optional().or(z.literal("")),
  socialLinks: z.array(
    z.object({
      platform: z.string(),
      url: z.string().max(512),
    }),
  ).max(8),
});

export async function saveStoreProfile(raw: z.infer<typeof profileSchema>) {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const { orgSlug, displayName, bio, photoUrl, socialLinks } = parsed.data;
  const result = await getOrgForOwner(orgSlug);
  if ("error" in result) return { error: result.error };
  const { org, supabase } = result;

  const { error: updateErr } = await supabase
    .from("organizations")
    .update({
      store_display_name: displayName || null,
      store_bio: bio || null,
      store_photo_url: photoUrl || null,
    })
    .eq("id", org.id);

  if (updateErr) return { error: "Erro ao salvar perfil." };

  await supabase
    .from("store_social_links")
    .delete()
    .eq("organization_id", org.id);

  if (socialLinks.length > 0) {
    const rows = socialLinks
      .filter((l) => l.url.trim())
      .map((l, i) => ({
        organization_id: org.id,
        platform: l.platform,
        url: l.url.trim(),
        position: i,
      }));

    if (rows.length > 0) {
      await supabase.from("store_social_links").insert(rows);
    }
  }

  revalidatePath(`/s/${orgSlug}`);
  return { success: true };
}

// --- Toggle ---

export async function toggleStoreEnabled(orgSlug: string, enabled: boolean) {
  const result = await getOrgForOwner(orgSlug);
  if ("error" in result) return { error: result.error };
  const { org, supabase } = result;

  const { error } = await supabase
    .from("organizations")
    .update({ store_enabled: enabled })
    .eq("id", org.id);

  if (error) return { error: "Erro ao atualizar." };

  revalidatePath(`/s/${orgSlug}`);
  return { success: true };
}

// --- Theme ---

const themeSchema = z.object({
  orgSlug: z.string().min(1),
  theme: z.object({
    colorScheme: z.enum(["light", "dark"]),
    primaryColor: z.string().max(20),
    backgroundColor: z.string().max(20),
    cardColor: z.string().max(20),
    textColor: z.string().max(20),
    fontFamily: z.enum(["geist", "inter", "poppins", "playfair"]),
    borderRadius: z.enum(["sm", "md", "lg", "full"]),
    cardLayout: z.enum(["horizontal", "vertical"]),
    coverImageUrl: z.string().url().max(2048).nullable().optional(),
  }),
});

export async function saveStoreTheme(raw: z.infer<typeof themeSchema>) {
  const parsed = themeSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const { orgSlug, theme } = parsed.data;
  const result = await getOrgForOwner(orgSlug);
  if ("error" in result) return { error: result.error };
  const { org, supabase } = result;

  const { error } = await supabase
    .from("organizations")
    .update({ store_theme: theme })
    .eq("id", org.id);

  if (error) return { error: "Erro ao salvar tema." };

  revalidatePath(`/s/${orgSlug}`);
  return { success: true };
}

// --- Chat Config ---

const chatConfigSchema = z.object({
  orgSlug: z.string().min(1),
  chatEnabled: z.boolean(),
  trigger: z.enum(["none", "timer", "scroll", "exit_intent"]),
  triggerSeconds: z.number().int().min(5).max(300),
  greeting: z.string().max(500).optional().or(z.literal("")),
});

export async function saveStoreChatConfig(raw: z.infer<typeof chatConfigSchema>) {
  const parsed = chatConfigSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const { orgSlug, chatEnabled, trigger, triggerSeconds, greeting } = parsed.data;
  const result = await getOrgForOwner(orgSlug);
  if ("error" in result) return { error: result.error };
  const { org, supabase } = result;

  const { error } = await supabase
    .from("organizations")
    .update({
      store_chat_enabled: chatEnabled,
      store_chat_trigger: trigger,
      store_chat_trigger_seconds: triggerSeconds,
      store_chat_greeting: greeting || null,
    })
    .eq("id", org.id);

  if (error) return { error: "Erro ao salvar configuração de chat." };

  revalidatePath(`/s/${orgSlug}`);
  return { success: true };
}

// --- Blocks ---

const addBlockSchema = z.object({
  orgSlug: z.string().min(1),
  type: z.enum(["product", "booking", "link"]),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().max(2048).optional().or(z.literal("")),
  ctaText: z.string().max(50).optional(),
  externalUrl: z.string().url().max(2048).optional().or(z.literal("")),
  priceDisplay: z.string().max(50).optional(),
  priceBrl: z.number().min(0).max(999999).optional(),
  durationMinutes: z.number().int().min(1).max(480).optional(),
  linkIcon: z.string().max(50).optional(),
  digitalProductId: z.string().uuid().optional().nullable(),
});

export async function addStoreBlock(raw: z.infer<typeof addBlockSchema>) {
  const parsed = addBlockSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const { orgSlug, type, title, description, imageUrl, ctaText, externalUrl, priceDisplay, priceBrl, durationMinutes, linkIcon, digitalProductId } = parsed.data;
  const result = await getOrgForOwner(orgSlug);
  if ("error" in result) return { error: result.error };
  const { org, supabase } = result;

  const { data: maxPos } = await supabase
    .from("store_blocks")
    .select("position")
    .eq("organization_id", org.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (maxPos?.position ?? -1) + 1;

  const { error } = await supabase.from("store_blocks").insert({
    organization_id: org.id,
    type,
    position,
    title: title || null,
    description: description || null,
    image_url: imageUrl || null,
    cta_text: ctaText || (type === "booking" ? "Agendar" : "Comprar"),
    external_url: externalUrl || null,
    price_display: priceDisplay || null,
    price_brl: priceBrl ?? null,
    duration_minutes: durationMinutes || null,
    link_icon: linkIcon || null,
    digital_product_id: digitalProductId || null,
  });

  if (error) return { error: "Erro ao adicionar bloco." };

  revalidatePath(`/s/${orgSlug}`);
  return { success: true };
}

const updateBlockSchema = z.object({
  orgSlug: z.string().min(1),
  blockId: z.string().uuid(),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().max(2048).optional().or(z.literal("")),
  ctaText: z.string().max(50).optional(),
  externalUrl: z.string().max(2048).optional().or(z.literal("")),
  priceDisplay: z.string().max(50).optional(),
  priceBrl: z.number().min(0).max(999999).optional().nullable(),
  durationMinutes: z.number().int().min(1).max(480).optional().nullable(),
  linkIcon: z.string().max(50).optional(),
  visible: z.boolean().optional(),
  digitalProductId: z.string().uuid().optional().nullable(),
});

export async function updateStoreBlock(raw: z.infer<typeof updateBlockSchema>) {
  const parsed = updateBlockSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const { orgSlug, blockId, ...updates } = parsed.data;
  const result = await getOrgForOwner(orgSlug);
  if ("error" in result) return { error: result.error };
  const { org, supabase } = result;

  const dbUpdates: Record<string, unknown> = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title || null;
  if (updates.description !== undefined) dbUpdates.description = updates.description || null;
  if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl || null;
  if (updates.ctaText !== undefined) dbUpdates.cta_text = updates.ctaText;
  if (updates.externalUrl !== undefined) dbUpdates.external_url = updates.externalUrl || null;
  if (updates.priceDisplay !== undefined) dbUpdates.price_display = updates.priceDisplay || null;
  if (updates.priceBrl !== undefined) dbUpdates.price_brl = updates.priceBrl;
  if (updates.durationMinutes !== undefined) dbUpdates.duration_minutes = updates.durationMinutes;
  if (updates.linkIcon !== undefined) dbUpdates.link_icon = updates.linkIcon || null;
  if (updates.visible !== undefined) dbUpdates.visible = updates.visible;
  if (updates.digitalProductId !== undefined) dbUpdates.digital_product_id = updates.digitalProductId || null;

  const { error } = await supabase
    .from("store_blocks")
    .update(dbUpdates)
    .eq("id", blockId)
    .eq("organization_id", org.id);

  if (error) return { error: "Erro ao atualizar bloco." };

  revalidatePath(`/s/${orgSlug}`);
  return { success: true };
}

export async function deleteStoreBlock(orgSlug: string, blockId: string) {
  const result = await getOrgForOwner(orgSlug);
  if ("error" in result) return { error: result.error };
  const { org, supabase } = result;

  const { error } = await supabase
    .from("store_blocks")
    .delete()
    .eq("id", blockId)
    .eq("organization_id", org.id);

  if (error) return { error: "Erro ao remover bloco." };

  revalidatePath(`/s/${orgSlug}`);
  return { success: true };
}

export async function reorderStoreBlocks(orgSlug: string, orderedIds: string[]) {
  const result = await getOrgForOwner(orgSlug);
  if ("error" in result) return { error: result.error };
  const { org, supabase } = result;

  const updates = orderedIds.map((id, index) =>
    supabase
      .from("store_blocks")
      .update({ position: index })
      .eq("id", id)
      .eq("organization_id", org.id),
  );

  await Promise.all(updates);

  revalidatePath(`/s/${orgSlug}`);
  return { success: true };
}
