"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { AesSecretStore, isValidEncryptionKeyHex } from "@/infrastructure/crypto/aes-secret-store";
import { connectCalCom, disconnectCalCom } from "@/application/use-cases/connect-cal-com";
import { connectStripe, disconnectStripe } from "@/application/use-cases/connect-stripe";
import { CalComAdapter } from "@/infrastructure/adapters/cal-com/adapter";
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

// --- Cal.com ---

const calSchema = z.object({
  orgSlug: z.string().min(1),
  apiKey: z.string().min(5).max(512),
  eventTypeId: z.string().min(1).max(32),
  timezone: z.string().min(1).max(64),
  bookingUrl: z.string().max(512).optional().default(""),
});

export async function saveCalComCredentials(raw: z.infer<typeof calSchema>) {
  scheduleTelemetryFlush();
  const parsed = calSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos. Verifique os campos." };

  const { supabase, org, error } = await resolveOrg(parsed.data.orgSlug);
  if (error || !org) return { error: error ?? "Organização não encontrada." };

  const key = process.env.ENCRYPTION_KEY?.trim() ?? "";
  if (!isValidEncryptionKeyHex(key)) return { error: "ENCRYPTION_KEY inválida no servidor." };

  const secretStore = new AesSecretStore(key);
  const calendarProvider = new CalComAdapter();

  const result = await connectCalCom(supabase, secretStore, calendarProvider, {
    orgId: org.id,
    apiKey: parsed.data.apiKey,
    eventTypeId: parsed.data.eventTypeId,
    timezone: parsed.data.timezone,
    bookingUrl: parsed.data.bookingUrl,
  });

  if (!result.ok) return { error: result.error.message };

  revalidatePath(`/${parsed.data.orgSlug}/integrations`);
  return { success: true as const };
}

export async function disconnectCalComAction(orgSlug: string) {
  scheduleTelemetryFlush();
  const { supabase, org, error } = await resolveOrg(orgSlug);
  if (error || !org) return { error: error ?? "Organização não encontrada." };

  const result = await disconnectCalCom(supabase, org.id);
  if (!result.ok) return { error: result.error.message };

  revalidatePath(`/${orgSlug}/integrations`);
  return { success: true as const };
}

// --- Stripe ---

const stripeSchema = z.object({
  orgSlug: z.string().min(1),
  secretKey: z.string().min(7).max(512),
});

export async function saveStripeCredentials(raw: z.infer<typeof stripeSchema>) {
  scheduleTelemetryFlush();
  const parsed = stripeSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos. Verifique os campos." };

  const { supabase, org, error } = await resolveOrg(parsed.data.orgSlug);
  if (error || !org) return { error: error ?? "Organização não encontrada." };

  const key = process.env.ENCRYPTION_KEY?.trim() ?? "";
  if (!isValidEncryptionKeyHex(key)) return { error: "ENCRYPTION_KEY inválida no servidor." };

  const secretStore = new AesSecretStore(key);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const result = await connectStripe(supabase, secretStore, {
    orgId: org.id,
    secretKey: parsed.data.secretKey,
    appUrl,
  });

  if (!result.ok) return { error: result.error.message };

  revalidatePath(`/${parsed.data.orgSlug}/integrations`);
  return { success: true as const };
}

export async function disconnectStripeAction(orgSlug: string) {
  scheduleTelemetryFlush();
  const { supabase, org, error } = await resolveOrg(orgSlug);
  if (error || !org) return { error: error ?? "Organização não encontrada." };

  const result = await disconnectStripe(supabase, org.id);
  if (!result.ok) return { error: result.error.message };

  revalidatePath(`/${orgSlug}/integrations`);
  return { success: true as const };
}
