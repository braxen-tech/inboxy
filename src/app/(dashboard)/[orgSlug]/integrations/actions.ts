"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import {
  AesSecretStore,
  isValidEncryptionKeyHex,
} from "@/infrastructure/crypto/aes-secret-store";
import { connectChatwoot, disconnectChatwoot } from "@/application/use-cases/connect-chatwoot";
import { connectCalCom, disconnectCalCom } from "@/application/use-cases/connect-cal-com";
import { connectStripe, disconnectStripe } from "@/application/use-cases/connect-stripe";
import { CalComAdapter } from "@/infrastructure/adapters/cal-com/adapter";

// --- Chatwoot ---

const chatwootConnectSchema = z.object({
  orgSlug: z.string().min(1),
  apiUrl: z.string().min(1).max(512),
  accountId: z.string().min(1).max(32),
  apiToken: z.string().min(5).max(8000),
});

export async function saveChatwootCredentials(raw: z.infer<typeof chatwootConnectSchema>) {
  const parsed = chatwootConnectSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Dados inválidos. Verifique os campos." };
  }

  const { orgSlug, apiUrl, accountId, apiToken } = parsed.data;
  const supabase = await getServerClientFromCookies();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não autenticado." };
  }

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id, name")
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

  const result = await connectChatwoot(supabase, secretStore, {
    orgId: org.id,
    orgName: (org.name as string) ?? orgSlug,
    apiUrl,
    apiToken,
    accountId,
  });

  if (!result.ok) {
    return { error: result.error.message };
  }

  revalidatePath(`/${orgSlug}/integrations`);
  return {
    success: true as const,
    agentBotWebhookUrl: result.value.agentBotWebhookUrl,
    botId: result.value.botId,
    hasBotAccessToken: result.value.hasBotAccessToken,
    linkedInboxes: result.value.linkedInboxes,
    failedInboxes: result.value.failedInboxes,
  };
}

export async function disconnectChatwootAction(orgSlug: string) {
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

  const result = await disconnectChatwoot(supabase, org.id);
  if (!result.ok) {
    return { error: result.error.message };
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

// --- Stripe ---

const stripeSchema = z.object({
  orgSlug: z.string().min(1),
  secretKey: z.string().min(7).max(512),
});

export async function saveStripeCredentials(raw: z.infer<typeof stripeSchema>) {
  const parsed = stripeSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Dados inválidos. Verifique os campos." };
  }

  const { orgSlug, secretKey } = parsed.data;
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const result = await connectStripe(supabase, secretStore, {
    orgId: org.id,
    secretKey,
    appUrl,
  });

  if (!result.ok) {
    return { error: result.error.message };
  }

  revalidatePath(`/${orgSlug}/integrations`);
  return { success: true as const };
}

export async function disconnectStripeAction(orgSlug: string) {
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

  const result = await disconnectStripe(supabase, org.id);
  if (!result.ok) {
    return { error: result.error.message };
  }

  revalidatePath(`/${orgSlug}/integrations`);
  return { success: true as const };
}
