"use server";

import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { getOrgBySlug } from "@/lib/get-org";
import { getStripe } from "@/infrastructure/adapters/stripe/client";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

interface CreateDiscountInput {
  code: string;
  description?: string;
  percentOff?: number;
  amountOffBrl?: number;
  maxUses?: number;
  expiresAt?: string;
}

export async function createDiscount(orgSlug: string, input: CreateDiscountInput) {
  const org = await getOrgBySlug(orgSlug);
  if (!org) return { error: "Organização não encontrada." };
  if (!org.stripe_account_id) return { error: "Stripe não configurado para esta organização." };

  const { code, description, percentOff, amountOffBrl, maxUses, expiresAt } = input;

  if (!code?.trim()) return { error: "Código é obrigatório." };
  if (!percentOff && !amountOffBrl) return { error: "Informe percentual ou valor de desconto." };
  if (percentOff && amountOffBrl) return { error: "Use percentual OU valor fixo, não ambos." };
  if (percentOff && (percentOff < 1 || percentOff > 100)) return { error: "Percentual deve ser entre 1 e 100." };

  const stripe = getStripe();

  try {
    const couponParams: Parameters<typeof stripe.coupons.create>[0] = {
      ...(percentOff ? { percent_off: percentOff } : { amount_off: Math.round(amountOffBrl! * 100), currency: "brl" }),
      ...(maxUses ? { max_redemptions: maxUses } : {}),
      ...(expiresAt ? { redeem_by: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
      metadata: { orgSlug, code: code.toUpperCase() },
    };

    const coupon = await stripe.coupons.create(couponParams, { stripeAccount: org.stripe_account_id });

    const promoCode = await stripe.promotionCodes.create(
      {
        promotion: { coupon: coupon.id, type: "coupon" },
        code: code.toUpperCase(),
        ...(maxUses ? { max_redemptions: maxUses } : {}),
        ...(expiresAt ? { expires_at: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
      },
      { stripeAccount: org.stripe_account_id },
    );

    const db = getAdminClient();
    const { error: dbErr } = await db.from("store_discounts").insert({
      organization_id: org.id,
      code: code.toUpperCase(),
      description: description ?? null,
      percent_off: percentOff ?? null,
      amount_off_brl: amountOffBrl ?? null,
      max_uses: maxUses ?? null,
      expires_at: expiresAt ?? null,
      stripe_coupon_id: coupon.id,
      stripe_promo_code_id: promoCode.id,
    });

    if (dbErr) {
      logger.error("createDiscount: db insert failed", { orgSlug, error: dbErr.message });
      return { error: "Erro ao salvar desconto." };
    }

    revalidatePath(`/${orgSlug}/store/discounts`);
    return { ok: true };
  } catch (err) {
    const msg = String(err);
    logger.error("createDiscount: Stripe error", { orgSlug, error: msg });
    if (msg.includes("already exists")) return { error: `Código "${code.toUpperCase()}" já existe.` };
    return { error: "Erro ao criar desconto no Stripe." };
  }
}

export async function deactivateDiscount(orgSlug: string, discountId: string) {
  const org = await getOrgBySlug(orgSlug);
  if (!org) return { error: "Organização não encontrada." };

  const db = getAdminClient();
  const { data: discount } = await db
    .from("store_discounts")
    .select("id, stripe_promo_code_id")
    .eq("id", discountId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!discount) return { error: "Desconto não encontrado." };

  if (org.stripe_account_id && discount.stripe_promo_code_id) {
    try {
      const stripe = getStripe();
      await stripe.promotionCodes.update(
        discount.stripe_promo_code_id,
        { active: false },
        { stripeAccount: org.stripe_account_id },
      );
    } catch (err) {
      logger.warn("deactivateDiscount: Stripe promo code update failed", { discountId, error: String(err) });
    }
  }

  await db.from("store_discounts").update({ active: false }).eq("id", discountId);
  revalidatePath(`/${orgSlug}/store/discounts`);
  return { ok: true };
}

export async function reactivateDiscount(orgSlug: string, discountId: string) {
  const org = await getOrgBySlug(orgSlug);
  if (!org) return { error: "Organização não encontrada." };

  const db = getAdminClient();
  const { data: discount } = await db
    .from("store_discounts")
    .select("id, stripe_promo_code_id, max_uses, uses_count, expires_at")
    .eq("id", discountId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!discount) return { error: "Desconto não encontrado." };

  if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
    return { error: "Não é possível reativar um desconto expirado." };
  }
  if (discount.max_uses && (discount.uses_count ?? 0) >= discount.max_uses) {
    return { error: "Limite de usos já atingido." };
  }

  if (org.stripe_account_id && discount.stripe_promo_code_id) {
    try {
      const stripe = getStripe();
      await stripe.promotionCodes.update(
        discount.stripe_promo_code_id,
        { active: true },
        { stripeAccount: org.stripe_account_id },
      );
    } catch (err) {
      logger.warn("reactivateDiscount: Stripe promo code update failed", { discountId, error: String(err) });
    }
  }

  await db.from("store_discounts").update({ active: true }).eq("id", discountId);
  revalidatePath(`/${orgSlug}/store/discounts`);
  return { ok: true };
}

export async function deleteDiscount(orgSlug: string, discountId: string) {
  const org = await getOrgBySlug(orgSlug);
  if (!org) return { error: "Organização não encontrada." };

  const db = getAdminClient();
  const { data: discount } = await db
    .from("store_discounts")
    .select("id, stripe_coupon_id, uses_count")
    .eq("id", discountId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!discount) return { error: "Desconto não encontrado." };
  if ((discount.uses_count ?? 0) > 0) return { error: "Não é possível excluir um desconto que já foi utilizado." };

  if (org.stripe_account_id && discount.stripe_coupon_id) {
    try {
      const stripe = getStripe();
      await stripe.coupons.del(discount.stripe_coupon_id, { stripeAccount: org.stripe_account_id });
    } catch (err) {
      logger.warn("deleteDiscount: Stripe coupon delete failed", { discountId, error: String(err) });
    }
  }

  await db.from("store_discounts").delete().eq("id", discountId);
  revalidatePath(`/${orgSlug}/store/discounts`);
  return { ok: true };
}

export async function listDiscounts(orgSlug: string) {
  const org = await getOrgBySlug(orgSlug);
  if (!org) return { error: "Organização não encontrada." };

  const db = getAdminClient();
  const { data, error } = await db
    .from("store_discounts")
    .select("id, code, description, percent_off, amount_off_brl, max_uses, uses_count, expires_at, active, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  if (error) return { error: "Erro ao buscar descontos." };
  return { data: data ?? [] };
}
