"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getAdminClient, getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { AesSecretStore, isValidEncryptionKeyHex } from "@/infrastructure/crypto/aes-secret-store";
import {
  connectTelegram,
  connectWhatsAppCloud,
  disconnectChannel,
} from "@/application/use-cases/connect-channel";
import { getOwnedOrg } from "@/lib/get-owned-org";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

type ActionError = { error: string };

async function authorize(orgSlug: string): Promise<{ orgId: string; secretStore: AesSecretStore } | ActionError> {
  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const org = await getOwnedOrg(orgSlug, user.id);
  if (!org) return { error: "Organização não encontrada ou sem permissão." };

  const key = process.env.ENCRYPTION_KEY?.trim() ?? "";
  if (!isValidEncryptionKeyHex(key)) return { error: "ENCRYPTION_KEY inválida no servidor." };

  return { orgId: org.id, secretStore: new AesSecretStore(key) };
}

const whatsappSchema = z.object({
  orgSlug: z.string().min(1),
  phoneNumberId: z.string().trim().regex(/^\d{5,30}$/, "Phone number ID deve conter só números."),
  wabaId: z.string().trim().regex(/^\d{0,30}$/).optional(),
  accessToken: z.string().trim().min(20).max(4000),
  appSecret: z.string().trim().min(16).max(256),
});

export async function connectWhatsAppAction(raw: z.infer<typeof whatsappSchema>) {
  scheduleTelemetryFlush();
  const parsed = whatsappSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const auth = await authorize(parsed.data.orgSlug);
  if ("error" in auth) return auth;

  const result = await connectWhatsAppCloud(getAdminClient(), auth.secretStore, {
    orgId: auth.orgId,
    phoneNumberId: parsed.data.phoneNumberId,
    wabaId: parsed.data.wabaId || undefined,
    accessToken: parsed.data.accessToken,
    appSecret: parsed.data.appSecret,
  });
  if (!result.ok) return { error: result.error.message };

  revalidatePath(`/${parsed.data.orgSlug}/integrations`);
  return { success: true as const, ...result.value };
}

const telegramSchema = z.object({
  orgSlug: z.string().min(1),
  botToken: z.string().trim().regex(/^\d+:[\w-]{30,}$/, "Token inválido. Copie o token completo do BotFather."),
});

export async function connectTelegramAction(raw: z.infer<typeof telegramSchema>) {
  scheduleTelemetryFlush();
  const parsed = telegramSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const auth = await authorize(parsed.data.orgSlug);
  if ("error" in auth) return auth;

  const result = await connectTelegram(getAdminClient(), auth.secretStore, {
    orgId: auth.orgId,
    botToken: parsed.data.botToken,
  });
  if (!result.ok) return { error: result.error.message };

  revalidatePath(`/${parsed.data.orgSlug}/integrations`);
  return { success: true as const, ...result.value };
}

export async function disconnectChannelAction(orgSlug: string, channel: "whatsapp_cloud" | "telegram") {
  scheduleTelemetryFlush();
  if (channel !== "whatsapp_cloud" && channel !== "telegram") return { error: "Canal inválido." };

  const auth = await authorize(orgSlug);
  if ("error" in auth) return auth;

  const result = await disconnectChannel(getAdminClient(), auth.secretStore, { orgId: auth.orgId, channel });
  if (!result.ok) return { error: result.error.message };

  revalidatePath(`/${orgSlug}/integrations`);
  return { success: true as const };
}
