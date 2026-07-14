"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { AesSecretStore, isValidEncryptionKeyHex } from "@/infrastructure/crypto/aes-secret-store";
import { connectChannel, disconnectChannel } from "@/application/use-cases/connect-channel";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

async function resolveOrg(orgSlug: string) {
  const supabase = await getServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." as const, supabase };

  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", orgSlug)
    .maybeSingle();

  if (error || !org) return { error: "Organização não encontrada ou sem permissão." as const, supabase };
  return { supabase, org };
}

const connectMetaSchema = z.object({
  orgSlug: z.string().min(1),
  type: z.enum(["whatsapp", "instagram"]),
  accessToken: z.string().min(10),
  metaBusinessId: z.string().optional().nullable(),
  wabaId: z.string().optional().nullable(),
  igUserId: z.string().optional().nullable(),
});

export async function saveChannelConnection(raw: z.infer<typeof connectMetaSchema>) {
  scheduleTelemetryFlush();
  const parsed = connectMetaSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const { supabase, org, error } = await resolveOrg(parsed.data.orgSlug);
  if (error || !org) return { error: error ?? "Organização não encontrada." };

  const key = process.env.ENCRYPTION_KEY?.trim() ?? "";
  if (!isValidEncryptionKeyHex(key)) return { error: "ENCRYPTION_KEY inválida no servidor." };

  const secretStore = new AesSecretStore(key);
  const result = await connectChannel(supabase, secretStore, {
    orgId: org.id,
    type: parsed.data.type,
    accessToken: parsed.data.accessToken,
    metaBusinessId: parsed.data.metaBusinessId,
    wabaId: parsed.data.wabaId,
    igUserId: parsed.data.igUserId,
  });

  if (!result.ok) return { error: result.error.message };

  revalidatePath(`/${parsed.data.orgSlug}/channels`);
  return {
    success: true as const,
    channelId: result.value.channelId,
    webhookVerifyToken: result.value.webhookVerifyToken,
    phoneNumber: result.value.phoneNumber,
  };
}

const connectTelegramSchema = z.object({
  orgSlug: z.string().min(1),
  botToken: z.string().min(20).max(200),
});

export async function connectTelegramChannel(raw: z.infer<typeof connectTelegramSchema>) {
  scheduleTelemetryFlush();
  const parsed = connectTelegramSchema.safeParse(raw);
  if (!parsed.success) return { error: "Token inválido." };

  const { supabase, org, error } = await resolveOrg(parsed.data.orgSlug);
  if (error || !org) return { error: error ?? "Organização não encontrada." };

  const key = process.env.ENCRYPTION_KEY?.trim() ?? "";
  if (!isValidEncryptionKeyHex(key)) return { error: "ENCRYPTION_KEY inválida no servidor." };

  const secretStore = new AesSecretStore(key);
  const result = await connectChannel(supabase, secretStore, {
    orgId: org.id,
    type: "telegram",
    accessToken: parsed.data.botToken.trim(),
  });

  if (!result.ok) return { error: result.error.message };

  revalidatePath(`/${parsed.data.orgSlug}/channels`);
  return {
    success: true as const,
    channelId: result.value.channelId,
    botUsername: result.value.botUsername,
  };
}

export async function disconnectChannelAction(orgSlug: string, channelId: string) {
  scheduleTelemetryFlush();
  const { supabase, org, error } = await resolveOrg(orgSlug);
  if (error || !org) return { error: error ?? "Organização não encontrada." };

  const key = process.env.ENCRYPTION_KEY?.trim() ?? "";
  const secretStore = isValidEncryptionKeyHex(key) ? new AesSecretStore(key) : undefined;

  const result = await disconnectChannel(supabase, org.id, channelId, { secretStore });
  if (!result.ok) return { error: result.error.message };

  revalidatePath(`/${orgSlug}/channels`);
  return { success: true as const };
}
