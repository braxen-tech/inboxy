import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { getStripe } from "@/infrastructure/adapters/stripe";
import { PLANS } from "@/lib/plans";
import type { PlanId } from "@/lib/plans";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

export async function POST(request: Request) {
  scheduleTelemetryFlush();

  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    logger.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    logger.warn("Stripe billing webhook: signature verification failed", { error: String(err) });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = getAdminClient();
  const eventId = `stripe_billing:${event.id}`;

  const { data: existing } = await db
    .from("processed_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ status: "already_processed" });
  }

  await db.from("processed_webhook_events").insert({ event_id: eventId, source: "stripe_billing" });

  try {
    await handleBillingEvent(db, event);
  } catch (error) {
    logger.error("Stripe billing webhook handler error", { eventId, error: String(error) });
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}

async function handleBillingEvent(
  db: ReturnType<typeof getAdminClient>,
  event: Stripe.Event,
) {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      const plan = (sub.metadata?.plan ?? "starter") as PlanId;
      if (!orgId) break;

      const status = sub.status === "active" || sub.status === "trialing" ? sub.status : sub.status;

      await db.from("organizations").update({
        stripe_subscription_id: sub.id,
        stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        subscription_status: status,
        subscription_plan: plan,
        message_quota: PLANS[plan]?.messageQuota ?? PLANS.starter.messageQuota,
        subscription_current_period_end: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
      }).eq("id", orgId);

      logger.info("Stripe billing: subscription updated", { orgId, plan, status: sub.status });
      captureServerEvent("platform_subscription_updated", { orgId, plan, status: sub.status });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      if (!orgId) break;

      await db.from("organizations").update({
        subscription_status: "canceled",
        message_quota: 0,
      }).eq("id", orgId);

      logger.info("Stripe billing: subscription canceled", { orgId });
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;

      await db.from("organizations").update({ subscription_status: "active" })
        .eq("stripe_customer_id", customerId)
        .neq("subscription_status", "active");
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;

      await db.from("organizations").update({ subscription_status: "past_due" })
        .eq("stripe_customer_id", customerId);

      logger.warn("Stripe billing: payment failed", { customerId });
      break;
    }

    default:
      logger.info("Stripe billing webhook: unhandled event", { type: event.type });
  }
}
