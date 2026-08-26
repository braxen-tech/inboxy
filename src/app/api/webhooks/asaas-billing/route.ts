import { NextResponse } from "next/server";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { parsePlatformCheckoutReference } from "@/infrastructure/adapters/asaas/billing-adapter";
import { PLANS } from "@/lib/plans";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";
import { scheduleTelemetryFlush } from "@/lib/schedule-telemetry-flush";

const CONFIRMED_EVENTS = new Set([
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_RECEIVED_IN_CASH",
]);

interface AsaasBillingWebhookPayload {
  event: string;
  payment?: {
    id: string;
    subscription?: string;
    customer?: string;
    externalReference?: string;
    nextDueDate?: string;
  };
}

export async function POST(request: Request) {
  scheduleTelemetryFlush();

  const expectedToken = process.env.ASAAS_BILLING_WEBHOOK_SECRET?.trim();
  if (!expectedToken) {
    logger.error("ASAAS_BILLING_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const receivedToken = request.headers.get("asaas-access-token");
  if (receivedToken !== expectedToken) {
    logger.warn("Asaas billing webhook: invalid token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: AsaasBillingWebhookPayload;
  try {
    payload = (await request.json()) as AsaasBillingWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, payment } = payload;
  if (!payment?.externalReference) {
    return NextResponse.json({ status: "ignored" });
  }

  const ref = parsePlatformCheckoutReference(payment.externalReference);
  if (!ref) {
    return NextResponse.json({ status: "ignored" });
  }

  const db = getAdminClient();
  const eventId = `asaas_billing:${payment.id}:${event}`;

  const { data: existing } = await db
    .from("processed_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ status: "already_processed" });
  }

  await db.from("processed_webhook_events").insert({ event_id: eventId, source: "asaas_billing" });

  const ctx = { orgId: ref.orgId, plan: ref.plan, event, paymentId: payment.id };

  if (CONFIRMED_EVENTS.has(event)) {
    const { error } = await db
      .from("organizations")
      .update({
        subscription_status: "active",
        subscription_plan: ref.plan,
        message_quota: PLANS[ref.plan].messageQuota,
        asaas_subscription_id: payment.subscription ?? null,
        asaas_customer_id: payment.customer ?? null,
        subscription_current_period_end: payment.nextDueDate ?? null,
      })
      .eq("id", ref.orgId);

    if (error) {
      logger.error("Asaas billing webhook: failed to activate subscription", { ...ctx, error: error.message });
      return NextResponse.json({ error: "DB update failed" }, { status: 500 });
    }

    logger.info("Platform subscription activated", ctx);
    captureServerEvent("platform_subscription_activated", ctx);
  } else if (event === "PAYMENT_OVERDUE") {
    await db.from("organizations").update({ subscription_status: "past_due" }).eq("id", ref.orgId);
    logger.warn("Platform subscription payment overdue", ctx);
  } else if (event === "PAYMENT_DELETED") {
    const { data: org } = await db
      .from("organizations")
      .select("asaas_subscription_id")
      .eq("id", ref.orgId)
      .maybeSingle();

    if (org?.asaas_subscription_id === payment.subscription) {
      await db
        .from("organizations")
        .update({ subscription_status: "canceled", asaas_subscription_id: null, message_quota: 0 })
        .eq("id", ref.orgId);
      logger.info("Platform subscription canceled", ctx);
    }
  } else {
    logger.info("Asaas billing webhook: unhandled event", ctx);
  }

  return NextResponse.json({ status: "ok" });
}
