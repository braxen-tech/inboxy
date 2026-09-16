import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { getStripe } from "@/infrastructure/adapters/stripe";
import { getEventBus } from "@/infrastructure/events/get-event-bus";
import { toOrgId, toConversationId, toMessageId } from "@/domain/value-objects";
import { sendEmail } from "@/lib/send-email";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

export async function POST(request: Request) {
  scheduleTelemetryFlush();

  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim();
  if (!secret) {
    logger.error("STRIPE_CONNECT_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    logger.warn("Stripe connect webhook: signature verification failed", { error: String(err) });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = getAdminClient();
  const eventId = `stripe_connect:${event.id}`;

  const { data: existing } = await db
    .from("processed_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ status: "already_processed" });
  }

  await db.from("processed_webhook_events").insert({ event_id: eventId, source: "stripe_connect" });

  try {
    await handleConnectEvent(db, event);
  } catch (error) {
    logger.error("Stripe connect webhook handler error", { eventId, error: String(error) });
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}

async function handleConnectEvent(
  db: ReturnType<typeof getAdminClient>,
  event: Stripe.Event,
) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // subscriptions: payment_status is "no_payment_required" until invoice is collected,
      // but session.status === "complete" is enough to grant access
      if (session.mode === "subscription") {
        if (session.status === "complete") await handleCheckoutCompleted(db, session);
      } else {
        if (session.payment_status === "paid") await handleCheckoutCompleted(db, session);
      }
      break;
    }

    case "customer.subscription.deleted": {
      // Access ends at period end — revoke when subscription is actually deleted
      const sub = event.data.object as Stripe.Subscription;
      await handleCourseSubscriptionCanceled(db, sub);
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await db
        .from("organizations")
        .update({
          stripe_charges_enabled: account.charges_enabled,
          stripe_payouts_enabled: account.payouts_enabled,
          stripe_account_status:
            account.charges_enabled && account.payouts_enabled ? "active" : "onboarding",
        })
        .eq("stripe_account_id", account.id);
      break;
    }

    default:
      logger.info("Stripe connect webhook: unhandled event", { type: event.type });
  }
}

async function handleCheckoutCompleted(
  db: ReturnType<typeof getAdminClient>,
  session: Stripe.Checkout.Session,
) {
  const meta = session.metadata ?? {};
  const { orgId, orderId, productId, courseId } = meta;
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  const { data: org } = await db
    .from("organizations")
    .select("id, slug, name")
    .eq("id", orgId)
    .maybeSingle();

  if (!org) {
    logger.warn("Stripe connect: org not found for session", { sessionId: session.id, orgId });
    return;
  }

  const buyerEmail = session.customer_details?.email ?? null;
  const buyerName = session.customer_details?.name ?? null;

  if (productId) {
    await handleDigitalPurchaseConfirmed(db, org, productId, buyerEmail, buyerName, session, paymentIntentId);
    return;
  }

  if (courseId) {
    await handleCourseEnrollmentConfirmed(db, org, courseId, buyerEmail, buyerName, session, paymentIntentId);
    return;
  }

  if (orderId) {
    await handleOrderConfirmed(db, org, orderId, session, paymentIntentId);
  }
}

async function handleDigitalPurchaseConfirmed(
  db: ReturnType<typeof getAdminClient>,
  org: { id: string; slug: string; name: string | null },
  productId: string,
  buyerEmail: string | null,
  buyerName: string | null,
  session: Stripe.Checkout.Session,
  paymentIntentId: string | null,
) {
  if (!buyerEmail) {
    logger.warn("Stripe connect: no buyer email in session", { sessionId: session.id, productId });
    return;
  }

  const { data: product } = await db
    .from("digital_products")
    .select("id, title, payment_type")
    .eq("id", productId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!product) {
    logger.warn("Stripe connect: digital product not found", { productId, orgId: org.id });
    return;
  }

  const { data: existingAccount } = await db
    .from("users")
    .select("id")
    .eq("email", buyerEmail)
    .eq("role", "end_user")
    .maybeSingle();

  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id ?? null;

  const { data: purchase, error: insertErr } = await db
    .from("digital_product_purchases")
    .insert({
      product_id: product.id,
      buyer_email: buyerEmail,
      buyer_name: buyerName ?? null,
      payment_type: product.payment_type ?? "one_time",
      status: "active",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_subscription_id: subscriptionId,
      end_user_id: existingAccount?.id ?? null,
    })
    .select("id")
    .single();

  if (insertErr || !purchase) {
    logger.error("Stripe connect: failed to create digital purchase", { productId, error: insertErr?.message });
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const emailParam = encodeURIComponent(buyerEmail);
  const accessLink = existingAccount
    ? `${appUrl}/portal/${org.slug}/login?email=${emailParam}`
    : `${appUrl}/portal/${org.slug}/signup?email=${emailParam}`;
  const accessCta = existingAccount ? "Entrar na minha conta" : "Criar minha conta";

  await sendEmail({
    to: buyerEmail,
    subject: `Sua compra de "${product.title}" foi confirmada`,
    html: `
      <p>Olá${buyerName ? `, ${buyerName}` : ""}!</p>
      <p>Seu pagamento foi confirmado e <strong>${product.title}</strong> já está disponível.</p>
      <p><a href="${accessLink}">${accessCta}</a></p>
      ${existingAccount ? "" : "<p>Use este mesmo e-mail para criar sua conta — sua compra já estará vinculada automaticamente.</p>"}
    `,
  });

  logger.info("Digital purchase activated via Stripe", { purchaseId: purchase.id });
  captureServerEvent("digital_purchase_activated", { purchase_id: purchase.id, orgId: org.id });
}

async function handleCourseEnrollmentConfirmed(
  db: ReturnType<typeof getAdminClient>,
  org: { id: string; slug: string; name: string | null },
  courseId: string,
  buyerEmail: string | null,
  buyerName: string | null,
  session: Stripe.Checkout.Session,
  paymentIntentId: string | null,
) {
  if (!buyerEmail) {
    logger.warn("Stripe connect: no buyer email in session", { sessionId: session.id, courseId });
    return;
  }

  const { data: course } = await db
    .from("courses")
    .select("id, title, payment_type")
    .eq("id", courseId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!course) {
    logger.warn("Stripe connect: course not found", { courseId, orgId: org.id });
    return;
  }

  const { data: existingAccount } = await db
    .from("users")
    .select("id")
    .eq("email", buyerEmail)
    .eq("role", "end_user")
    .maybeSingle();

  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id ?? null;

  const { data: enrollment, error: insertErr } = await db
    .from("course_enrollments")
    .insert({
      course_id: course.id,
      buyer_email: buyerEmail,
      buyer_name: buyerName ?? null,
      payment_type: course.payment_type ?? "one_time",
      status: "active",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_subscription_id: subscriptionId,
      end_user_id: existingAccount?.id ?? null,
    })
    .select("id")
    .single();

  if (insertErr || !enrollment) {
    logger.error("Stripe connect: failed to create course enrollment", { courseId, error: insertErr?.message });
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const emailParam = encodeURIComponent(buyerEmail);
  const accessLink = existingAccount
    ? `${appUrl}/portal/${org.slug}/login?email=${emailParam}`
    : `${appUrl}/portal/${org.slug}/signup?email=${emailParam}`;
  const accessCta = existingAccount ? "Entrar na minha conta" : "Criar minha conta";

  await sendEmail({
    to: buyerEmail,
    subject: `Sua matrícula em "${course.title}" foi confirmada`,
    html: `
      <p>Olá${buyerName ? `, ${buyerName}` : ""}!</p>
      <p>Seu pagamento foi confirmado e você já tem acesso ao curso <strong>${course.title}</strong>.</p>
      <p><a href="${accessLink}">${accessCta}</a></p>
      ${existingAccount ? "" : "<p>Use este mesmo e-mail para criar sua conta — sua matrícula já estará vinculada automaticamente.</p>"}
    `,
  });

  logger.info("Course enrollment activated via Stripe", { enrollmentId: enrollment.id });
  captureServerEvent("course_enrollment_activated", { enrollment_id: enrollment.id, orgId: org.id });
}

async function handleCourseSubscriptionCanceled(
  db: ReturnType<typeof getAdminClient>,
  sub: Stripe.Subscription,
) {
  const periodEnd = (sub as unknown as { current_period_end: number }).current_period_end;
  const expiresAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : new Date().toISOString();

  const { data: enrollment } = await db
    .from("course_enrollments")
    .select("id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();

  if (enrollment) {
    await db.from("course_enrollments")
      .update({ status: "canceled", expires_at: expiresAt })
      .eq("id", enrollment.id);
    logger.info("Course enrollment canceled via subscription", { enrollmentId: enrollment.id });
    return;
  }

  const { data: purchase } = await db
    .from("digital_product_purchases")
    .select("id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();

  if (purchase) {
    await db.from("digital_product_purchases")
      .update({ status: "canceled" })
      .eq("id", purchase.id);
    logger.info("Digital purchase canceled via subscription", { purchaseId: purchase.id });
    return;
  }

  logger.warn("Stripe connect: no enrollment/purchase found for canceled subscription", { subId: sub.id });
}

async function handleOrderConfirmed(
  db: ReturnType<typeof getAdminClient>,
  org: { id: string; slug: string; name: string | null },
  orderId: string,
  session: Stripe.Checkout.Session,
  paymentIntentId: string | null,
) {
  const { error: updateErr } = await db
    .from("orders")
    .update({
      status: "paid",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("organization_id", org.id);

  if (updateErr) {
    logger.error("Stripe connect: failed to update order", { orderId, error: updateErr.message });
    return;
  }

  logger.info("Order marked as paid via Stripe", { orderId });
  captureServerEvent("stripe_payment_received", { order_id: orderId, orgId: org.id });

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

  const amountTotal = session.amount_total ?? 0;
  const totalFormatted = amountTotal
    ? `R$ ${(amountTotal / 100).toFixed(2).replace(".", ",")}`
    : "";

  if (!order?.conversation_id) {
    await notifyOrgOwnerOfStoreSale(db, org, { itemsSummary, totalFormatted });
    return;
  }

  await triggerAgentAfterPayment(db, {
    orgId: org.id,
    conversationId: order.conversation_id,
    itemsSummary,
    totalFormatted,
  });
}

async function notifyOrgOwnerOfStoreSale(
  db: ReturnType<typeof getAdminClient>,
  org: { id: string; name: string | null },
  params: { itemsSummary: string; totalFormatted: string },
) {
  const { itemsSummary, totalFormatted } = params;

  const { data: owner } = await db
    .from("users")
    .select("email")
    .eq("organization_id", org.id)
    .eq("role", "org_owner")
    .maybeSingle();

  if (!owner?.email) return;

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
}

async function triggerAgentAfterPayment(
  db: ReturnType<typeof getAdminClient>,
  params: {
    orgId: string;
    conversationId: string;
    itemsSummary: string;
    totalFormatted: string;
  },
) {
  const { orgId, conversationId, itemsSummary, totalFormatted } = params;

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
      logger.error("Stripe connect: failed to insert synthetic message", {
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

    logger.info("Agent triggered after Stripe payment", { conversationId });
  } catch (error) {
    logger.error("Stripe connect: failed to trigger agent", { conversationId, error });
  }
}
