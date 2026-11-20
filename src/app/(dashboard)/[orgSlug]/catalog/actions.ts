"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getAdminClient, getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import {
  BILLING_OPTIONS,
  createCatalogItem,
  setCatalogItemActive,
  updateCatalogItem,
} from "@/infrastructure/adapters/stripe/catalog-admin";
import { getOwnedOrg } from "@/lib/get-owned-org";
import { logger } from "@/lib/logger";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

const MIN_AMOUNT_CENTS = 100;

async function connectedAccount(orgSlug: string): Promise<{ account: string } | { error: string }> {
  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const org = await getOwnedOrg(orgSlug, user.id);
  if (!org) return { error: "Organização não encontrada ou sem permissão." };

  const { data } = await getAdminClient()
    .from("organizations")
    .select("stripe_account_id, stripe_account_status")
    .eq("id", org.id)
    .single();
  if (!data?.stripe_account_id || data.stripe_account_status !== "active") {
    return { error: "Conecte o Stripe em Integrações antes de cadastrar produtos." };
  }
  return { account: data.stripe_account_id as string };
}

const productSchema = z.object({
  orgSlug: z.string().min(1),
  name: z.string().trim().min(2, "Nome muito curto.").max(250),
  description: z.string().trim().max(2000).optional(),
  imageUrl: z.union([z.literal(""), z.url("URL da imagem inválida.")]).optional(),
  amountBrl: z.number().positive("Informe o preço."),
  billing: z.enum(BILLING_OPTIONS),
});

export type ProductFormInput = z.infer<typeof productSchema>;

function toCents(brl: number) {
  return Math.round(brl * 100);
}

function friendlyError(err: unknown): string {
  const message = (err as { message?: string })?.message ?? String(err);
  return `O Stripe recusou a operação: ${message}`;
}

export async function saveCatalogProduct(raw: ProductFormInput & { productId?: string }) {
  scheduleTelemetryFlush();
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const amountCents = toCents(parsed.data.amountBrl);
  if (amountCents < MIN_AMOUNT_CENTS) return { error: "O preço mínimo é R$ 1,00." };

  const auth = await connectedAccount(parsed.data.orgSlug);
  if ("error" in auth) return auth;

  const input = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    imageUrl: parsed.data.imageUrl || null,
    amountCents,
    billing: parsed.data.billing,
  };

  try {
    const productId = typeof raw.productId === "string" && raw.productId.startsWith("prod_") ? raw.productId : null;
    if (productId) await updateCatalogItem(auth.account, productId, input);
    else await createCatalogItem(auth.account, input);
  } catch (err) {
    logger.error("Catalog save failed", { orgSlug: parsed.data.orgSlug, error: String(err) });
    return { error: friendlyError(err) };
  }

  revalidatePath(`/${parsed.data.orgSlug}/catalog`);
  return { success: true as const };
}

export async function setCatalogProductActive(orgSlug: string, productId: string, active: boolean) {
  scheduleTelemetryFlush();
  if (!productId.startsWith("prod_")) return { error: "Produto inválido." };

  const auth = await connectedAccount(orgSlug);
  if ("error" in auth) return auth;

  try {
    await setCatalogItemActive(auth.account, productId, active);
  } catch (err) {
    logger.error("Catalog archive failed", { orgSlug, productId, error: String(err) });
    return { error: friendlyError(err) };
  }

  revalidatePath(`/${orgSlug}/catalog`);
  return { success: true as const };
}
