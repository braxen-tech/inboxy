import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { subscriptionFieldsFromStripe } from "@/infrastructure/adapters/stripe/billing-adapter";
import { activateOrgFromCheckoutSession } from "@/application/services/sync-billing-from-checkout";
import { createPlatformStripeClient, getBillingWebhookSecret } from "@/infrastructure/adapters/stripe/platform-client";
import { logger } from "@/lib/logger";
import { captureServerEvent, captureServerException } from "@/lib/posthog-server";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

export async function POST(request: Request) {
  scheduleTelemetryFlush();
  const webhookSecret = getBillingWebhookSecret();
  if (!webhookSecret) {
    logger.error("STRIPE_BILLING_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    const stripe = createPlatformStripeClient();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.warn("Stripe billing webhook signature invalid", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const db = getAdminClient();

  const { data: existing } = await db
    .from("processed_webhook_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ status: "already_processed" });
  }

  await db.from("processed_webhook_events").insert({ id: event.id, source: "stripe_billing" });

  const ctx = { eventId: event.id, eventType: event.type };

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(db, event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(db, event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(db, event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(db, event.data.object as Stripe.Invoice);
        break;
      case "invoice.paid":
        await handleInvoicePaid(db, event.data.object as Stripe.Invoice);
        break;
      default:
        logger.info("Stripe billing webhook: unhandled event", ctx);
    }
  } catch (err) {
    logger.error("Stripe billing webhook handler error", {
      ...ctx,
      error: err instanceof Error ? err.message : String(err),
    });
    captureServerException(err, ctx);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}

function customerIdFrom(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id ?? null;
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const details = invoice.parent?.subscription_details;
  const sub = details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

async function resolveOrgId(
  db: ReturnType<typeof getAdminClient>,
  metadata: Stripe.Metadata | null,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
  subscriptionId?: string | null,
): Promise<string | null> {
  if (metadata?.org_id) return metadata.org_id;

  const cid = customerIdFrom(customer);
  if (cid) {
    const { data } = await db
      .from("organizations")
      .select("id")
      .eq("stripe_customer_id", cid)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  if (subscriptionId) {
    const { data } = await db
      .from("organizations")
      .select("id")
      .eq("subscription_id", subscriptionId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return null;
}

async function handleCheckoutCompleted(
  db: ReturnType<typeof getAdminClient>,
  session: Stripe.Checkout.Session,
) {
  const synced = await activateOrgFromCheckoutSession(db, session);
  if (!synced) {
    logger.warn("checkout.session.completed: sync skipped", { sessionId: session.id });
  }
}

async function handleSubscriptionUpdated(
  db: ReturnType<typeof getAdminClient>,
  sub: Stripe.Subscription,
) {
  const orgId = await resolveOrgId(db, sub.metadata, sub.customer, sub.id);
  if (!orgId) {
    logger.warn("subscription.updated: org not found", { subscriptionId: sub.id });
    return;
  }

  const fields = subscriptionFieldsFromStripe(sub);
  const { error } = await db.from("organizations").update(fields).eq("id", orgId);
  if (error) throw new Error(error.message);

  logger.info("Subscription updated", { orgId, plan: fields.subscription_plan, status: fields.subscription_status });
  captureServerEvent("stripe_subscription_updated", {
    orgId,
    plan: fields.subscription_plan,
    status: fields.subscription_status,
  });
}

async function handleSubscriptionDeleted(
  db: ReturnType<typeof getAdminClient>,
  sub: Stripe.Subscription,
) {
  const orgId = await resolveOrgId(db, sub.metadata, sub.customer, sub.id);
  if (!orgId) return;

  const { error } = await db
    .from("organizations")
    .update({
      subscription_status: "canceled",
      subscription_id: null,
      message_quota: 0,
    })
    .eq("id", orgId);

  if (error) throw new Error(error.message);
  logger.info("Subscription canceled", { orgId });
}

async function handlePaymentFailed(
  db: ReturnType<typeof getAdminClient>,
  invoice: Stripe.Invoice,
) {
  const subscriptionId = subscriptionIdFromInvoice(invoice);

  const orgId = await resolveOrgId(db, invoice.metadata, invoice.customer, subscriptionId);
  if (!orgId) return;

  const { error } = await db
    .from("organizations")
    .update({ subscription_status: "past_due" })
    .eq("id", orgId);

  if (error) throw new Error(error.message);
  logger.warn("Subscription payment failed", { orgId });
}

async function handleInvoicePaid(
  db: ReturnType<typeof getAdminClient>,
  invoice: Stripe.Invoice,
) {
  const subscriptionId = subscriptionIdFromInvoice(invoice);

  if (!subscriptionId) return;

  const orgId = await resolveOrgId(db, invoice.metadata, invoice.customer, subscriptionId);
  if (!orgId) return;

  const stripe = createPlatformStripeClient();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const fields = subscriptionFieldsFromStripe(sub);

  const { error } = await db
    .from("organizations")
    .update(fields)
    .eq("id", orgId);

  if (error) throw new Error(error.message);
  logger.info("Invoice paid, subscription synced", { orgId });
}
