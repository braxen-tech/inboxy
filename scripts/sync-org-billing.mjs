import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const orgId = process.argv[2] ?? "8ac158db-051d-4156-838c-ce005bd6540f";

const stripeKey = process.env.STRIPE_BILLING_SECRET_KEY?.trim();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!stripeKey || !supabaseUrl || !serviceRole) {
  console.error("Missing STRIPE_BILLING_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const stripe = new Stripe(stripeKey);
const db = createClient(supabaseUrl, serviceRole);

const planMap = {
  price_1Tdxhp2Fvr0aymbcYy0WEoig: "starter",
  price_1Tdxhp2Fvr0aymbcv9dDpAgo: "professional",
  price_1Tdxhp2Fvr0aymbciEYzoW7v: "business",
};
const quotaMap = { starter: 500, professional: 2000, business: 10000 };

const result = await stripe.subscriptions.search({
  query: `metadata["org_id"]:"${orgId}"`,
  limit: 1,
});

const sub = result.data[0];
if (!sub) {
  console.error("NO_SUB for org", orgId);
  process.exit(1);
}

const priceId = sub.items.data[0]?.price?.id;
const plan = planMap[priceId] ?? "starter";
const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
const periodEnd = sub.items.data[0]?.current_period_end ?? sub.current_period_end;

const { error } = await db
  .from("organizations")
  .update({
    subscription_id: sub.id,
    subscription_status: sub.status === "trialing" ? "trialing" : "active",
    subscription_plan: plan,
    message_quota: quotaMap[plan],
    subscription_current_period_end: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
    stripe_customer_id: customerId,
  })
  .eq("id", orgId);

if (error) {
  console.error("DB_ERROR", error.message);
  process.exit(1);
}

const { data } = await db
  .from("organizations")
  .select("slug, subscription_id, subscription_plan, subscription_status")
  .eq("id", orgId)
  .single();

console.log(JSON.stringify(data, null, 2));
