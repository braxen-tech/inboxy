"use server";

import { z } from "zod/v4";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { AesSecretStore, isValidEncryptionKeyHex } from "@/infrastructure/crypto/aes-secret-store";
import { createPaymentLink, AsaasApiError } from "@/infrastructure/adapters/asaas";
import { digitalPurchaseReference } from "@/lib/asaas-checkout-refs";
import { logger } from "@/lib/logger";

type BillingCycle = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY";

async function getActiveOrgAndKey(orgSlug: string) {
  const db = getAdminClient();

  const { data: org } = await db
    .from("organizations")
    .select("id, name, asaas_status, asaas_api_key_enc")
    .eq("slug", orgSlug)
    .eq("store_enabled", true)
    .maybeSingle();

  if (!org) {
    return { error: "Loja não encontrada." } as const;
  }

  if (org.asaas_status !== "active" || !org.asaas_api_key_enc) {
    return { error: "Pagamentos não configurados para esta loja." } as const;
  }

  const key = process.env.ENCRYPTION_KEY?.trim() ?? "";
  if (!isValidEncryptionKeyHex(key)) {
    return { error: "Erro de configuração no servidor." } as const;
  }
  const secretStore = new AesSecretStore(key);

  let apiKey: string;
  try {
    apiKey = secretStore.decrypt(org.asaas_api_key_enc);
  } catch {
    return { error: "Erro ao acessar credenciais de pagamento." } as const;
  }

  return { db, org, apiKey } as const;
}

/** Generates an Asaas payment link for a storefront product/service block (physical/service — org fulfills directly). */
export async function createDirectCheckout(orgSlug: string, blockId: string) {
  const result = await getActiveOrgAndKey(orgSlug);
  if ("error" in result) return result;
  const { db, org, apiKey } = result;

  const { data: block } = await db
    .from("store_blocks")
    .select("id, title, description, price_brl, payment_type, billing_cycle")
    .eq("id", blockId)
    .eq("organization_id", org.id)
    .eq("type", "product")
    .eq("visible", true)
    .maybeSingle();

  if (!block || !block.price_brl || block.price_brl <= 0) {
    return { error: "Produto não encontrado ou sem preço definido." };
  }

  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      organization_id: org.id,
      source: "store",
      status: "checkout",
      total_amount: Math.round(block.price_brl * 100),
      currency: "brl",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    logger.error("Direct checkout: failed to create order", { orgSlug, blockId, error: orderError?.message });
    return { error: "Erro ao iniciar checkout." };
  }

  await db.from("order_items").insert({
    order_id: order.id,
    product_id: block.id,
    price_id: block.id,
    product_name: block.title ?? "Produto",
    quantity: 1,
    unit_amount: Math.round(block.price_brl * 100),
  });

  const isRecurring = block.payment_type === "recurring" && block.billing_cycle;

  try {
    const link = await createPaymentLink(apiKey, {
      name: block.title ?? "Produto",
      description: block.description ?? undefined,
      billingType: "UNDEFINED",
      chargeType: isRecurring ? "RECURRENT" : "DETACHED",
      value: block.price_brl,
      externalReference: order.id,
      ...(isRecurring
        ? {
            subscriptionCycle: block.billing_cycle!.toUpperCase() as BillingCycle,
            dueDateLimitDays: 5,
          }
        : {}),
    });

    await db
      .from("orders")
      .update({ asaas_payment_id: link.id, asaas_payment_link: link.url })
      .eq("id", order.id);

    return { url: link.url };
  } catch (error) {
    if (error instanceof AsaasApiError) {
      logger.error("Direct checkout: Asaas error", { orgSlug, blockId, status: error.status, body: error.body });
      return { error: "Erro ao gerar link de pagamento." };
    }
    logger.error("Direct checkout failed", { orgSlug, blockId, error: String(error) });
    return { error: "Erro ao gerar link de pagamento." };
  }
}

const buyerSchema = z.object({
  buyerEmail: z.email(),
  buyerName: z.string().max(200).optional(),
});

/** Generates an Asaas payment link for a digital product and returns its URL. */
export async function createDigitalProductCheckout(
  orgSlug: string,
  productId: string,
  raw: { buyerEmail: string; buyerName?: string },
) {
  const parsed = buyerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Informe um e-mail válido." };
  }
  const { buyerEmail, buyerName } = parsed.data;

  const result = await getActiveOrgAndKey(orgSlug);
  if ("error" in result) return result;
  const { db, org, apiKey } = result;

  const { data: product } = await db
    .from("digital_products")
    .select("id, title, description, price_brl, payment_type, billing_cycle, active")
    .eq("id", productId)
    .eq("organization_id", org.id)
    .eq("active", true)
    .maybeSingle();

  if (!product || !product.price_brl || product.price_brl <= 0) {
    return { error: "Produto não encontrado ou sem preço definido." };
  }

  const { data: purchase, error: purchaseError } = await db
    .from("digital_product_purchases")
    .insert({
      product_id: product.id,
      buyer_email: buyerEmail,
      buyer_name: buyerName ?? null,
      payment_type: product.payment_type,
      status: "pending",
    })
    .select("id")
    .single();

  if (purchaseError || !purchase) {
    logger.error("Digital checkout: failed to create purchase", { orgSlug, productId, error: purchaseError?.message });
    return { error: "Erro ao iniciar checkout." };
  }

  const isRecurring = product.payment_type === "recurring" && product.billing_cycle;

  try {
    const link = await createPaymentLink(apiKey, {
      name: product.title,
      description: product.description ?? undefined,
      billingType: "UNDEFINED",
      chargeType: isRecurring ? "RECURRENT" : "DETACHED",
      value: product.price_brl,
      externalReference: digitalPurchaseReference(purchase.id),
      ...(isRecurring
        ? {
            subscriptionCycle: product.billing_cycle!.toUpperCase() as BillingCycle,
            dueDateLimitDays: 5,
          }
        : {}),
    });

    await db
      .from("digital_product_purchases")
      .update({ asaas_payment_id: link.id })
      .eq("id", purchase.id);

    return { url: link.url };
  } catch (error) {
    if (error instanceof AsaasApiError) {
      logger.error("Digital checkout: Asaas error", { orgSlug, productId, status: error.status, body: error.body });
      return { error: "Erro ao gerar link de pagamento." };
    }
    logger.error("Digital checkout failed", { orgSlug, productId, error: String(error) });
    return { error: "Erro ao gerar link de pagamento." };
  }
}
