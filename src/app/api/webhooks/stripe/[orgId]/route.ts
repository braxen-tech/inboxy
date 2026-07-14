import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { StripePaymentAdapter } from "@/infrastructure/adapters/stripe/payment-adapter";
import { WhatsAppCloudAdapter } from "@/infrastructure/adapters/whatsapp-cloud";
import { InstagramDmAdapter } from "@/infrastructure/adapters/instagram-dm";
import { AesSecretStore } from "@/infrastructure/crypto/aes-secret-store";
import { getEventBus } from "@/infrastructure/events/get-event-bus";
import { toOrgId, toConversationId, toMessageId } from "@/domain/value-objects";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

const paymentAdapter = new StripePaymentAdapter();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  scheduleTelemetryFlush();
  const { orgId } = await params;
  const db = getAdminClient();

  const { data: org } = await db
    .from("organizations")
    .select("id, stripe_webhook_secret")
    .eq("id", orgId)
    .eq("stripe_status", "active")
    .single();

  if (!org || !org.stripe_webhook_secret) {
    logger.warn("Stripe webhook: no active org", { orgId });
    return NextResponse.json({ status: "ignored" }, { status: 404 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  const eventResult = paymentAdapter.verifyWebhookSignature(
    body,
    signature,
    org.stripe_webhook_secret,
  );

  if (!eventResult.ok) {
    logger.warn("Stripe webhook signature invalid", { orgId, error: eventResult.error.message });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = eventResult.value;

  const { data: existing } = await db
    .from("processed_webhook_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ status: "already_processed" });
  }

  await db.from("processed_webhook_events").insert({ event_id: event.id, source: "stripe" });

  const ctx = { orgId, eventType: event.type, eventId: event.id };

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await handleCheckoutCompleted(db, org, event.data.object, ctx);
      break;

    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
      await handleCheckoutFailed(db, event.data.object, ctx);
      break;

    default:
      logger.info("Stripe webhook: unhandled event type", ctx);
  }

  return NextResponse.json({ status: "ok" });
}

async function handleCheckoutCompleted(
  db: ReturnType<typeof getAdminClient>,
  org: Record<string, any>,
  session: Record<string, unknown>,
  ctx: Record<string, string>,
) {
  const metadata = session.metadata as Record<string, string> | undefined;
  const orderId = metadata?.orderId;
  const conversationId = metadata?.conversationId;

  if (!orderId) {
    logger.warn("Stripe checkout completed: no orderId in metadata", ctx);
    return;
  }

  const paymentStatus = session.payment_status as string;
  if (paymentStatus !== "paid") {
    logger.info("Stripe checkout completed but payment_status not paid, waiting for async", { ...ctx, paymentStatus });
    return;
  }

  const { error: updateErr } = await db
    .from("orders")
    .update({
      status: "paid",
      stripe_payment_intent_id: (session.payment_intent as string) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updateErr) {
    logger.error("Failed to update order to paid", { ...ctx, orderId, error: updateErr.message });
    return;
  }

  logger.info("Order marked as paid", { ...ctx, orderId });
  captureServerEvent("stripe_payment_received", { ...ctx, order_id: orderId });

  if (conversationId) {
    const { data: orderItems } = await db
      .from("order_items")
      .select("product_name, quantity")
      .eq("order_id", orderId);

    const itemsSummary = (orderItems ?? [])
      .map((i) => `${i.quantity}x ${i.product_name}`)
      .join(", ");

    const amountTotal = session.amount_total as number | undefined;
    const totalFormatted = amountTotal
      ? `R$ ${(amountTotal / 100).toFixed(2).replace(".", ",")}`
      : "";

    try {
      const { data: conversation } = await db
        .from("conversations")
        .select("external_conversation_id, channels(*)")
        .eq("id", conversationId)
        .single();

      const channel = conversation?.channels as unknown as
        | {
            type: "whatsapp" | "instagram";
            status: string;
            access_token: string | null;
            phone_number_id: string | null;
            ig_user_id: string | null;
          }
        | null;

      if (channel && channel.status === "active" && channel.access_token && conversation?.external_conversation_id) {
        const encKey = process.env.ENCRYPTION_KEY?.trim() ?? "";
        const secretStore = new AesSecretStore(encKey);
        const accessToken = secretStore.decrypt(channel.access_token);

        const message = [
          "Pagamento confirmado! ✓",
          "",
          `Pedido: ${itemsSummary}`,
          totalFormatted ? `Valor: ${totalFormatted}` : "",
          "",
          "Obrigado pela compra!",
        ]
          .filter(Boolean)
          .join("\n");

        const adapter =
          channel.type === "whatsapp" ? new WhatsAppCloudAdapter() : new InstagramDmAdapter();

        await adapter.send({
          accessToken,
          fromExternalId: (channel.type === "whatsapp" ? channel.phone_number_id : channel.ig_user_id) ?? "",
          toExternalId: conversation.external_conversation_id,
          content: message,
        });

        logger.info("Payment confirmation sent to customer", { ...ctx, conversationId });
      }
    } catch (error) {
      logger.error("Failed to send payment confirmation", { ...ctx, error });
    }

    await triggerAgentAfterPayment(db, {
      orgId: ctx.orgId,
      conversationId,
      itemsSummary,
      totalFormatted,
      ctx,
    });
  }
}

/**
 * Inserts a synthetic inbound message describing the payment and enqueues the
 * agent pipeline (via Inngest) so the AI can respond with dynamic next steps
 * (e.g. suggest calendar slots), instead of only sending a static confirmation.
 */
async function triggerAgentAfterPayment(
  db: ReturnType<typeof getAdminClient>,
  params: {
    orgId: string;
    conversationId: string;
    itemsSummary: string;
    totalFormatted: string;
    ctx: Record<string, string>;
  },
): Promise<void> {
  const { orgId, conversationId, itemsSummary, totalFormatted, ctx } = params;

  try {
    const correlationId = randomUUID();

    const syntheticContent = [
      "[PAGAMENTO CONFIRMADO]",
      "O cliente acabou de pagar. Não pergunte se o pagamento foi feito nem peça para aguardar confirmação — ele já está confirmado.",
      `Pedido: ${itemsSummary || "Nao informado"}`,
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
      logger.error("Failed to insert synthetic payment message", {
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

    logger.info("Agent triggered after payment confirmation", { ...ctx, conversationId });
  } catch (error) {
    logger.error("Failed to trigger agent after payment", { ...ctx, conversationId, error });
  }
}

async function handleCheckoutFailed(
  db: ReturnType<typeof getAdminClient>,
  session: Record<string, unknown>,
  ctx: Record<string, string>,
) {
  const metadata = session.metadata as Record<string, string> | undefined;
  const orderId = metadata?.orderId;

  if (!orderId) return;

  const status = ctx.eventType === "checkout.session.expired" ? "expired" : "cancelled";

  await db
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  logger.info(`Order marked as ${status}`, { ...ctx, orderId });
}
