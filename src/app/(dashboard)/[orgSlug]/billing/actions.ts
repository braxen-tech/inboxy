"use server";

import { z } from "zod/v4";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { AsaasBillingAdapter } from "@/infrastructure/adapters/asaas";
import { toOrgId } from "@/domain/value-objects";
import type { PlanId } from "@/lib/plans";
import { needsBillingSetup } from "@/lib/billing-setup";
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

  const adapter = new AsaasBillingAdapter(getAdminClient());
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

/** Re-reads billing state from the DB — the Asaas webhook updates it asynchronously after checkout. */
export async function syncBillingStatusAction(orgSlug: string) {
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

  const db = getAdminClient();
  const { data: fullOrg } = await db
    .from("organizations")
    .select("subscription_status")
    .eq("id", org.id)
    .single();

  if (!fullOrg) {
    return { error: "Organização não encontrada." };
  }

  return { ok: !needsBillingSetup(fullOrg) };
}
