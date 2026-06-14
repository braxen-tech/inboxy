import { NextResponse } from "next/server";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { StripePaymentAdapter } from "@/infrastructure/adapters/stripe/payment-adapter";
import { ChatwootAdapter } from "@/infrastructure/adapters/chatwoot/adapter";
import { AesSecretStore } from "@/infrastructure/crypto/aes-secret-store";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

const paymentAdapter = new StripePaymentAdapter();
const messagingAdapter = new ChatwootAdapter();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  scheduleTelemetryFlush();
  const { orgId } = await params;
  const db = getAdminClient();

  const { data: org } = await db
    .from("organizations")
    .select("id, stripe_webhook_secret, chatwoot_api_url, chatwoot_api_token, chatwoot_account_id, chatwoot_status")
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
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ status: "already_processed" });
  }

  await db.from("processed_webhook_events").insert({ id: event.id, source: "stripe" });

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

  if (conversationId && org.chatwoot_status === "active" && org.chatwoot_api_token) {
    try {
      const { data: conversation } = await db
        .from("conversations")
        .select("chatwoot_conversation_id")
        .eq("id", conversationId)
        .single();

      if (conversation?.chatwoot_conversation_id) {
        const encKey = process.env.ENCRYPTION_KEY?.trim() ?? "";
        const secretStore = new AesSecretStore(encKey);
        const apiToken = secretStore.decrypt(org.chatwoot_api_token);

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

        const message = [
          "Pagamento confirmado! ✓",
          "",
          `Pedido: ${itemsSummary}`,
          totalFormatted ? `Valor: ${totalFormatted}` : "",
          "",
          "Obrigado pela compra!",
        ].filter(Boolean).join("\n");

        await messagingAdapter.send({
          apiUrl: org.chatwoot_api_url,
          apiToken,
          accountId: org.chatwoot_account_id,
          conversationId: conversation.chatwoot_conversation_id,
          content: message,
        });

        logger.info("Payment confirmation sent to customer", { ...ctx, conversationId });
      }
    } catch (error) {
      logger.error("Failed to send payment confirmation", { ...ctx, error });
    }
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
