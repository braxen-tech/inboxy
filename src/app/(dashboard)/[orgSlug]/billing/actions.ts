"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { StripeBillingAdapter } from "@/infrastructure/adapters/stripe/billing-adapter";
import { syncOrgFromCheckoutSessionId, syncOrgBillingFromStripe } from "@/application/services/sync-billing-from-checkout";
import { toOrgId } from "@/domain/value-objects";
import type { PlanId } from "@/lib/plans";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

const planSchema = z.enum(["starter", "professional", "business"]);

async function getOwnedOrg(orgSlug: string, userId: string) {
  const db = getAdminClient();
  const { data: org } = await db
    .from("organizations")
    .select("id, slug, owner_user_id")
    .eq("slug", orgSlug)
    .single();

  if (!org || org.owner_user_id !== userId) return null;
  return org;
}

export async function createCheckoutSessionAction(orgSlug: string, plan: string) {
  scheduleTelemetryFlush();
  const parsed = planSchema.safeParse(plan);
  if (!parsed.success) {
    return { error: "Plano inválido." };
  }

  const supabase = await getServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { error: "Não autenticado." };
  }

  const org = await getOwnedOrg(orgSlug, user.id);
  if (!org) {
    return { error: "Organização não encontrada ou sem permissão." };
  }

  const adapter = new StripeBillingAdapter(getAdminClient());
  const result = await adapter.createCheckoutSession(
    toOrgId(org.id),
    parsed.data as PlanId,
    user.email,
  );

  if (!result.ok) {
    return { error: result.error.message };
  }

  return { url: result.value };
}

export async function createPortalSessionAction(orgSlug: string) {
  scheduleTelemetryFlush();
  const supabase = await getServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não autenticado." };
  }

  const org = await getOwnedOrg(orgSlug, user.id);
  if (!org) {
    return { error: "Organização não encontrada ou sem permissão." };
  }

  const adapter = new StripeBillingAdapter(getAdminClient());
  const result = await adapter.createPortalSession(toOrgId(org.id));

  if (!result.ok) {
    return { error: result.error.message };
  }

  revalidatePath(`/${orgSlug}/billing`);
  return { url: result.value };
}

export async function syncCheckoutSessionAction(orgSlug: string, sessionId: string) {
  scheduleTelemetryFlush();
  const trimmed = sessionId.trim();
  if (!trimmed.startsWith("cs_")) {
    return { error: "Sessão de checkout inválida." };
  }

  const supabase = await getServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não autenticado." };
  }

  const org = await getOwnedOrg(orgSlug, user.id);
  if (!org) {
    return { error: "Organização não encontrada ou sem permissão." };
  }

  try {
    const synced = await syncOrgFromCheckoutSessionId(getAdminClient(), trimmed, org.id);
    revalidatePath(`/${orgSlug}/billing`);
    revalidatePath(`/${orgSlug}`);
    return synced ? { ok: true as const } : { error: "Checkout ainda não concluído no Stripe." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falha ao sincronizar assinatura.",
    };
  }
}

export async function syncBillingFromStripeAction(orgSlug: string) {
  scheduleTelemetryFlush();
  const supabase = await getServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não autenticado." };
  }

  const org = await getOwnedOrg(orgSlug, user.id);
  if (!org) {
    return { error: "Organização não encontrada ou sem permissão." };
  }

  try {
    const synced = await syncOrgBillingFromStripe(getAdminClient(), org.id);
    revalidatePath(`/${orgSlug}/billing`);
    revalidatePath(`/${orgSlug}`);
    return synced ? { ok: true as const } : { error: "Nenhuma assinatura ativa encontrada no Stripe." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falha ao sincronizar assinatura.",
    };
  }
}
