"use server";

import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { StripePaymentAdapter } from "@/infrastructure/adapters/stripe";
import { logger } from "@/lib/logger";

async function getActiveStripeOrg(orgSlug: string) {
  const db = getAdminClient();

  const { data: org } = await db
    .from("organizations")
    .select("id, name, stripe_account_id, stripe_account_status")
    .eq("slug", orgSlug)
    .eq("store_enabled", true)
    .maybeSingle();

  if (!org) return { error: "Loja não encontrada." } as const;

  // TODO(pre-launch): require stripe_account_status === "active" once v2 account
  // status sync is reliable. Currently relaxed because sandbox capabilities don't
  // auto-activate and syncAccountStatus may return "onboarding" even after completing.
  if (!org.stripe_account_id) {
    return { error: "Pagamentos não configurados para esta loja." } as const;
  }

  return { org } as const;
}

const stripe = new StripePaymentAdapter();

/** Creates a Stripe Checkout Session for a storefront product/service block. */
export async function createDirectCheckout(orgSlug: string, blockId: string) {
  const result = await getActiveStripeOrg(orgSlug);
  if ("error" in result) return result;
  const { org } = result;
  const db = getAdminClient();

  const { data: block } = await db
    .from("store_blocks")
    .select("id, title, description, price_brl")
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

  const checkoutResult = await stripe.createCheckoutSession({
    stripeAccountId: org.stripe_account_id,
    lineItems: [{ productId: block.id, productName: block.title ?? "Produto", quantity: 1, unitAmountBrl: block.price_brl }],
    metadata: { orgId: org.id, orderId: order.id },
  });

  if (!checkoutResult.ok) {
    logger.error("Direct checkout: Stripe error", { orgSlug, blockId, error: checkoutResult.error.message });
    return { error: "Erro ao gerar link de pagamento." };
  }

  await db.from("orders")
    .update({ stripe_checkout_session_id: checkoutResult.value.paymentId })
    .eq("id", order.id);

  return { url: checkoutResult.value.url };
}

/** Creates a Stripe Checkout Session for a digital product. */
export async function createDigitalProductCheckout(orgSlug: string, productId: string) {
  const result = await getActiveStripeOrg(orgSlug);
  if ("error" in result) return result;
  const { org } = result;

  const db = getAdminClient();
  const { data: product } = await db
    .from("digital_products")
    .select("id, title, price_brl, payment_type, active")
    .eq("id", productId)
    .eq("organization_id", org.id)
    .eq("active", true)
    .maybeSingle();

  if (!product || !product.price_brl || product.price_brl <= 0) {
    return { error: "Produto não encontrado ou sem preço definido." };
  }

  // Purchase record is created in the webhook after payment confirmation,
  // using customer_details from the Stripe session.
  const checkoutResult = await stripe.createCheckoutSession({
    stripeAccountId: org.stripe_account_id,
    lineItems: [{ productId: product.id, productName: product.title, quantity: 1, unitAmountBrl: product.price_brl }],
    metadata: { orgId: org.id, productId: product.id },
    mode: product.payment_type === "recurring" ? "subscription" : "payment",
  });

  if (!checkoutResult.ok) {
    logger.error("Digital checkout: Stripe error", { orgSlug, productId, error: checkoutResult.error.message });
    return { error: "Erro ao gerar link de pagamento." };
  }

  return { url: checkoutResult.value.url };
}

/** Creates a Stripe Checkout Session for a course enrollment. */
export async function createCourseCheckout(orgSlug: string, courseId: string) {
  const result = await getActiveStripeOrg(orgSlug);
  if ("error" in result) return result;
  const { org } = result;

  const db = getAdminClient();
  const { data: course } = await db
    .from("courses")
    .select("id, title, price_brl, payment_type, active")
    .eq("id", courseId)
    .eq("organization_id", org.id)
    .eq("active", true)
    .maybeSingle();

  if (!course || !course.price_brl || course.price_brl <= 0) {
    return { error: "Curso não encontrado ou sem preço definido." };
  }

  // Enrollment record is created in the webhook after payment confirmation,
  // using customer_details from the Stripe session.
  const checkoutResult = await stripe.createCheckoutSession({
    stripeAccountId: org.stripe_account_id,
    lineItems: [{ productId: course.id, productName: course.title, quantity: 1, unitAmountBrl: course.price_brl }],
    metadata: { orgId: org.id, courseId: course.id },
    mode: course.payment_type === "recurring" ? "subscription" : "payment",
  });

  if (!checkoutResult.ok) {
    logger.error("Course checkout: Stripe error", { orgSlug, courseId, error: checkoutResult.error.message });
    return { error: "Erro ao gerar link de pagamento." };
  }

  return { url: checkoutResult.value.url };
}
