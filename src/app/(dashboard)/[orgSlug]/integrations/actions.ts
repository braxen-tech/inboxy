"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import {
  AesSecretStore,
  isValidEncryptionKeyHex,
} from "@/infrastructure/crypto/aes-secret-store";
import { connectWhatsAppManual } from "@/application/use-cases/connect-whatsapp-manual";
import { connectCalCom, disconnectCalCom } from "@/application/use-cases/connect-cal-com";
import { CalComAdapter } from "@/infrastructure/adapters/cal-com/adapter";

const schema = z.object({
  orgSlug: z.string().min(1),
  wabaId: z.string().min(1).max(64),
  phoneNumberId: z.string().min(1).max(64),
  accessToken: z.string().min(20).max(8000),
});

export async function saveWhatsAppCredentials(raw: z.infer<typeof schema>) {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Dados inválidos. Verifique os campos." };
  }

  const { orgSlug, wabaId, phoneNumberId, accessToken } = parsed.data;
  const supabase = await getServerClientFromCookies();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não autenticado." };
  }

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();

  if (orgErr || !org) {
    return { error: "Organização não encontrada ou sem permissão." };
  }

  const key = process.env.ENCRYPTION_KEY?.trim() ?? "";
  if (!isValidEncryptionKeyHex(key)) {
    return {
      error:
        "ENCRYPTION_KEY inválida no servidor: use exatamente 64 caracteres hex (ex.: openssl rand -hex 32).",
    };
  }

  const secretStore = new AesSecretStore(key);
  const result = await connectWhatsAppManual(supabase, secretStore, {
    orgId: org.id,
    wabaId,
    phoneNumberId,
    accessToken,
  });

  if (!result.ok) {
    return { error: result.error.message };
  }

  revalidatePath(`/${orgSlug}/integrations`);
  return { success: true as const, phone: result.value.displayPhoneNumber };
}

export async function disconnectWhatsApp(orgSlug: string) {
  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não autenticado." };
  }

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();

  if (orgErr || !org) {
    return { error: "Organização não encontrada ou sem permissão." };
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      whatsapp_business_account_id: null,
      whatsapp_phone_number_id: null,
      whatsapp_phone_number: null,
      whatsapp_access_token: null,
      whatsapp_pin: null,
      whatsapp_status: "disconnected",
    })
    .eq("id", org.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/${orgSlug}/integrations`);
  return { success: true as const };
}

// --- Cal.com ---

const calSchema = z.object({
  orgSlug: z.string().min(1),
  apiKey: z.string().min(5).max(512),
  eventTypeId: z.string().min(1).max(32),
  timezone: z.string().min(1).max(64),
  bookingUrl: z.string().max(512).optional().default(""),
});

export async function saveCalComCredentials(raw: z.infer<typeof calSchema>) {
  const parsed = calSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Dados inválidos. Verifique os campos." };
  }

  const { orgSlug, apiKey, eventTypeId, timezone, bookingUrl } = parsed.data;
  const supabase = await getServerClientFromCookies();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não autenticado." };
  }

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();

  if (orgErr || !org) {
    return { error: "Organização não encontrada ou sem permissão." };
  }

  const key = process.env.ENCRYPTION_KEY?.trim() ?? "";
  if (!isValidEncryptionKeyHex(key)) {
    return { error: "ENCRYPTION_KEY inválida no servidor." };
  }

  const secretStore = new AesSecretStore(key);
  const calendarProvider = new CalComAdapter();

  const result = await connectCalCom(supabase, secretStore, calendarProvider, {
    orgId: org.id,
    apiKey,
    eventTypeId,
    timezone,
    bookingUrl,
  });

  if (!result.ok) {
    return { error: result.error.message };
  }

  revalidatePath(`/${orgSlug}/integrations`);
  return { success: true as const };
}

export async function disconnectCalComAction(orgSlug: string) {
  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não autenticado." };
  }

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();

  if (orgErr || !org) {
    return { error: "Organização não encontrada ou sem permissão." };
  }

  const result = await disconnectCalCom(supabase, org.id);
  if (!result.ok) {
    return { error: result.error.message };
  }

  revalidatePath(`/${orgSlug}/integrations`);
  return { success: true as const };
}
