"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { StripeBillingAdapter } from "@/infrastructure/adapters/stripe/billing-adapter";
import {
  syncOrgFromCheckoutSessionId,
  syncOrgBillingFromStripe,
} from "@/application/services/sync-billing-from-checkout";
import { toOrgId } from "@/domain/value-objects";
import type { PlanId } from "@/lib/plans";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";
import { requireOrgCapability } from "@/lib/authz-server";

const planSchema = z.enum(["starter", "professional", "business"]);

export async function createCheckoutSessionAction(orgSlug: string, plan: string) {
  scheduleTelemetryFlush();
  const parsed = planSchema.safeParse(plan);
  if (!parsed.success) {
    return { error: "Plano inválido." };
  }

  const ctx = await requireOrgCapability(orgSlug, "manage_billing");
  if ("error" in ctx) return { error: ctx.error };
  if (!ctx.user.email) return { error: "Não autenticado." };

  const adapter = new StripeBillingAdapter(getAdminClient());
  const result = await adapter.createCheckoutSession(
    toOrgId(ctx.org.id),
    parsed.data as PlanId,
    ctx.user.email,
  );

  if (!result.ok) {
    return { error: result.error.message };
  }

  return { url: result.value };
}

export async function createPortalSessionAction(orgSlug: string) {
  scheduleTelemetryFlush();
  const ctx = await requireOrgCapability(orgSlug, "manage_billing");
  if ("error" in ctx) return { error: ctx.error };

  const adapter = new StripeBillingAdapter(getAdminClient());
  const result = await adapter.createPortalSession(toOrgId(ctx.org.id));

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

  const ctx = await requireOrgCapability(orgSlug, "manage_billing");
  if ("error" in ctx) return { error: ctx.error };

  try {
    const synced = await syncOrgFromCheckoutSessionId(getAdminClient(), trimmed, ctx.org.id);
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
  const ctx = await requireOrgCapability(orgSlug, "manage_billing");
  if ("error" in ctx) return { error: ctx.error };

  try {
    const synced = await syncOrgBillingFromStripe(getAdminClient(), ctx.org.id);
    revalidatePath(`/${orgSlug}/billing`);
    revalidatePath(`/${orgSlug}`);
    return synced ? { ok: true as const } : { error: "Nenhuma assinatura ativa encontrada no Stripe." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falha ao sincronizar assinatura.",
    };
  }
}
