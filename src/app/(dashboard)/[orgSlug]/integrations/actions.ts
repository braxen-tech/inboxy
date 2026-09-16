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
import { CalComAdapter } from "@/infrastructure/adapters/cal-com/adapter";
import { provisionStripeConnectedAccount, disconnectStripe, refreshStripeAccountStatus } from "@/application/use-cases/connect-stripe";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

// --- Chatwoot ---

const chatwootConnectSchema = z.object({
  orgSlug: z.string().min(1),
  apiUrl: z.string().min(1).max(512),
  accountId: z.string().min(1).max(32),
  apiToken: z.string().min(5).max(8000),
});

export async function saveChatwootCredentials(raw: z.infer<typeof chatwootConnectSchema>) {
  scheduleTelemetryFlush();
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
  scheduleTelemetryFlush();
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
});

export async function saveCalComCredentials(raw: z.infer<typeof calSchema>) {
  scheduleTelemetryFlush();
  const parsed = calSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Dados inválidos. Verifique os campos." };
  }

  const { orgSlug, apiKey, eventTypeId, timezone } = parsed.data;
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
  });

  if (!result.ok) {
    return { error: result.error.message };
  }

  revalidatePath(`/${orgSlug}/integrations`);
  return { success: true as const };
}

export async function disconnectCalComAction(orgSlug: string) {
  scheduleTelemetryFlush();
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

// --- Stripe Connect ---

export async function activateStripe(orgSlug: string) {
  scheduleTelemetryFlush();
  const supabase = await getServerClientFromCookies();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
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

  const result = await provisionStripeConnectedAccount(supabase, org.id, user.email);
  if (!result.ok) {
    return { error: result.error.message };
  }

  revalidatePath(`/${orgSlug}/integrations`);
  return { success: true as const, accountId: result.value.accountId };
}

export async function refreshStripeStatusAction(orgSlug: string) {
  scheduleTelemetryFlush();
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

  const result = await refreshStripeAccountStatus(supabase, org.id);
  if (!result.ok) {
    return { error: result.error.message };
  }

  revalidatePath(`/${orgSlug}/integrations`);
  return { success: true as const, status: result.value.status };
}

export async function disconnectStripeAction(orgSlug: string) {
  scheduleTelemetryFlush();
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

