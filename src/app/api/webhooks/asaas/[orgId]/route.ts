import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { getEventBus } from "@/infrastructure/events/get-event-bus";
import { toOrgId, toConversationId, toMessageId } from "@/domain/value-objects";
import { parseDigitalPurchaseReference } from "@/lib/asaas-checkout-refs";
import { sendEmail } from "@/lib/send-email";
import { AesSecretStore, isValidEncryptionKeyHex } from "@/infrastructure/crypto/aes-secret-store";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

// Asaas payment events that mean the order is confirmed
const CONFIRMED_EVENTS = new Set([
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_RECEIVED_IN_CASH",
]);

interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    status: string;
    value: number;
    netValue?: number;
    externalReference?: string;
    description?: string;
  };
}

interface OrgInfo {
  id: string;
  slug: string;
  name: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  scheduleTelemetryFlush();
  const { orgId } = await params;
  const db = getAdminClient();

  const { data: org } = await db
    .from("organizations")
    .select("id, slug, name, asaas_api_key_enc, asaas_status, asaas_webhook_token_enc")
    .eq("id", orgId)
    .eq("asaas_status", "active")
    .maybeSingle();

  if (!org) {
    logger.warn("Asaas webhook: org not found or not active", { orgId });
    return NextResponse.json({ status: "ignored" }, { status: 404 });
  }

  if (org.asaas_webhook_token_enc) {
    const key = process.env.ENCRYPTION_KEY?.trim() ?? "";
    const receivedToken = request.headers.get("asaas-access-token");
    let expectedToken: string | null = null;
    try {
      if (isValidEncryptionKeyHex(key)) {
        expectedToken = new AesSecretStore(key).decrypt(org.asaas_webhook_token_enc);
      }
    } catch {
      // fall through to reject below
    }

    if (!expectedToken || receivedToken !== expectedToken) {
      logger.warn("Asaas webhook: invalid token", { orgId });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: AsaasWebhookPayload;
  try {
    payload = (await request.json()) as AsaasWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, payment } = payload;
  const ctx = { orgId, event, paymentId: payment?.id };

  logger.info("Asaas webhook received", ctx);

  if (!payment?.externalReference) {
    logger.info("Asaas webhook: no externalReference, ignoring", ctx);
    return NextResponse.json({ status: "ignored" });
  }

  const eventId = `asaas:${payment.id}:${event}`;

  const { data: existing } = await db
    .from("processed_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ status: "already_processed" });
  }

  await db.from("processed_webhook_events").insert({ event_id: eventId, source: "asaas" });

  const digitalPurchaseId = parseDigitalPurchaseReference(payment.externalReference);

  if (digitalPurchaseId) {
    if (CONFIRMED_EVENTS.has(event)) {
      await handleDigitalPurchaseConfirmed(db, org, digitalPurchaseId, payment, ctx);
    } else if (event === "PAYMENT_OVERDUE" || event === "PAYMENT_DELETED") {
      await db
        .from("digital_product_purchases")
        .update({ status: "canceled" })
        .eq("id", digitalPurchaseId);
      logger.info("Digital purchase canceled", { ...ctx, digitalPurchaseId });
    } else {
      logger.info("Asaas webhook: unhandled digital purchase event", ctx);
    }
    return NextResponse.json({ status: "ok" });
  }

  if (CONFIRMED_EVENTS.has(event)) {
    await handlePaymentConfirmed(db, org, payment.externalReference, payment, ctx);
  } else if (event === "PAYMENT_OVERDUE" || event === "PAYMENT_DELETED") {
    await handlePaymentFailed(db, payment.externalReference, event, ctx);
  } else {
    logger.info("Asaas webhook: unhandled event", ctx);
  }

  return NextResponse.json({ status: "ok" });
}

/**
 * Activates the purchase and emails the buyer a link to create their own password-protected
 * account (or log in, if they already have one). No magic link / passwordless auto-login —
 * the account creation flow already backfills end_user_id by matching buyer_email on signup
 * (see handle_new_auth_user trigger), so linking happens automatically once they sign up.
 */
async function handleDigitalPurchaseConfirmed(
  db: ReturnType<typeof getAdminClient>,
  org: OrgInfo,
  purchaseId: string,
  payment: NonNullable<AsaasWebhookPayload["payment"]>,
  ctx: Record<string, unknown>,
) {
  const { data: purchase } = await db
    .from("digital_product_purchases")
    .select("id, buyer_email, buyer_name, product_id, digital_products!inner(organization_id, title)")
    .eq("id", purchaseId)
    .eq("digital_products.organization_id", org.id)
    .maybeSingle();

  if (!purchase) {
    logger.warn("Digital purchase webhook: purchase not found for org", { ...ctx, purchaseId });
    return;
  }

  const product = Array.isArray(purchase.digital_products)
    ? purchase.digital_products[0]
    : purchase.digital_products;
  const productTitle = (product as { title?: string } | null)?.title ?? "seu produto";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const emailParam = encodeURIComponent(purchase.buyer_email);

  const { data: existingAccount } = await db
    .from("users")
    .select("id")
    .eq("email", purchase.buyer_email)
    .eq("role", "end_user")
    .maybeSingle();

  const accessLink = existingAccount
    ? `${appUrl}/portal/${org.slug}/login?email=${emailParam}`
    : `${appUrl}/portal/${org.slug}/signup?email=${emailParam}`;
  const accessCta = existingAccount ? "Entrar na minha conta" : "Criar minha conta";

  const { error: updateErr } = await db
    .from("digital_product_purchases")
    .update({
      status: "active",
      asaas_payment_id: payment.id,
      end_user_id: existingAccount?.id ?? null,
    })
    .eq("id", purchaseId);

  if (updateErr) {
    logger.error("Digital purchase webhook: failed to activate", { ...ctx, purchaseId, error: updateErr.message });
    return;
  }

  await sendEmail({
    to: purchase.buyer_email,
    subject: `Sua compra de "${productTitle}" foi confirmada`,
    html: `
      <p>Olá${purchase.buyer_name ? `, ${purchase.buyer_name}` : ""}!</p>
      <p>Seu pagamento foi confirmado e <strong>${productTitle}</strong> já está disponível.</p>
      <p><a href="${accessLink}">${accessCta}</a></p>
      ${existingAccount ? "" : "<p>Use este mesmo e-mail para criar sua conta — sua compra já estará vinculada automaticamente.</p>"}
    `,
  });

  logger.info("Digital purchase activated", { ...ctx, purchaseId, hasExistingAccount: !!existingAccount });
  captureServerEvent("digital_purchase_activated", { ...ctx, purchase_id: purchaseId });
}

async function handlePaymentConfirmed(
  db: ReturnType<typeof getAdminClient>,
  org: OrgInfo,
  orderId: string,
  payment: NonNullable<AsaasWebhookPayload["payment"]>,
  ctx: Record<string, unknown>,
) {
  const { error: updateErr } = await db
    .from("orders")
    .update({
      status: "paid",
      asaas_payment_id: payment.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("organization_id", org.id);

  if (updateErr) {
    logger.error("Asaas webhook: failed to update order", { ...ctx, orderId, error: updateErr.message });
    return;
  }

  logger.info("Order marked as paid", { ...ctx, orderId });
  captureServerEvent("asaas_payment_received", { ...ctx, order_id: orderId });

  const { data: order } = await db
    .from("orders")
    .select("conversation_id")
    .eq("id", orderId)
    .maybeSingle();

  const { data: orderItems } = await db
    .from("order_items")
    .select("product_name, quantity")
    .eq("order_id", orderId);

  const itemsSummary = (orderItems ?? [])
    .map((i) => `${i.quantity}x ${i.product_name}`)
    .join(", ");

  const totalFormatted = payment.value
    ? `R$ ${payment.value.toFixed(2).replace(".", ",")}`
    : "";

  if (!order?.conversation_id) {
    // Storefront purchase with no WhatsApp conversation — notify the org owner directly.
    await notifyOrgOwnerOfStoreSale(db, org, { itemsSummary, totalFormatted, ctx });
    return;
  }

  await triggerAgentAfterPayment(db, {
    orgId: org.id,
    conversationId: order.conversation_id,
    itemsSummary,
    totalFormatted,
    ctx,
  });
}

async function notifyOrgOwnerOfStoreSale(
  db: ReturnType<typeof getAdminClient>,
  org: OrgInfo,
  params: { itemsSummary: string; totalFormatted: string; ctx: Record<string, unknown> },
) {
  const { itemsSummary, totalFormatted, ctx } = params;

  const { data: owner } = await db
    .from("users")
    .select("email")
    .eq("organization_id", org.id)
    .eq("role", "org_owner")
    .maybeSingle();

  if (!owner?.email) {
    logger.warn("Store sale: org owner email not found", { ...ctx, orgId: org.id });
    return;
  }

  await sendEmail({
    to: owner.email,
    subject: `Nova venda na sua loja${totalFormatted ? ` — ${totalFormatted}` : ""}`,
    html: `
      <p>Você recebeu um novo pedido pela sua loja Inboxy.</p>
      <p><strong>Itens:</strong> ${itemsSummary || "não informado"}</p>
      ${totalFormatted ? `<p><strong>Valor:</strong> ${totalFormatted}</p>` : ""}
      <p>Combine a entrega/atendimento com o cliente pelo seu canal habitual.</p>
    `,
  });

  logger.info("Store owner notified of sale", { ...ctx, orgId: org.id });
}

async function handlePaymentFailed(
  db: ReturnType<typeof getAdminClient>,
  orderId: string,
  event: string,
  ctx: Record<string, unknown>,
) {
  const status = event === "PAYMENT_DELETED" ? "cancelled" : "expired";

  await db
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  logger.info(`Order marked as ${status}`, { ...ctx, orderId });
}

async function triggerAgentAfterPayment(
  db: ReturnType<typeof getAdminClient>,
  params: {
    orgId: string;
    conversationId: string;
    itemsSummary: string;
    totalFormatted: string;
    ctx: Record<string, unknown>;
  },
) {
  const { orgId, conversationId, itemsSummary, totalFormatted, ctx } = params;

  try {
    const correlationId = randomUUID();

    const syntheticContent = [
      "[PAGAMENTO CONFIRMADO]",
      "O cliente acabou de pagar. Não pergunte se o pagamento foi feito — ele já está confirmado.",
      `Pedido: ${itemsSummary || "Não informado"}`,
      totalFormatted ? `Valor: ${totalFormatted}` : "",
      "",
      "Prossiga com os próximos passos conforme suas instruções (ex: agendar reunião, enviar orientações, etc).",
    ].filter(Boolean).join("\n");

    const { data: syntheticMsg, error: insertErr } = await db
      .from("messages")
      .insert({
        organization_id: orgId,
        conversation_id: conversationId,
        direction: "inbound",
        content: syntheticContent,
        status: "received",
        correlation_id: correlationId,
      })
      .select("id")
      .single();

    if (insertErr || !syntheticMsg) {
      logger.error("Asaas webhook: failed to insert synthetic message", {
        ...ctx,
        conversationId,
        error: insertErr?.message,
      });
      return;
    }

    await getEventBus().emit({
      type: "message.received",
      payload: {
        orgId: toOrgId(orgId),
        conversationId: toConversationId(conversationId),
        messageId: toMessageId(syntheticMsg.id),
        correlationId,
      },
    });

    logger.info("Agent triggered after Asaas payment", { ...ctx, conversationId });
  } catch (error) {
    logger.error("Asaas webhook: failed to trigger agent", { ...ctx, conversationId, error });
  }
}
