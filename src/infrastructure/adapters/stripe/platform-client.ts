import Stripe from "stripe";
import { createStripeClient } from "./client";

export function getPlatformStripeSecretKey(): string | null {
  const key = process.env.STRIPE_BILLING_SECRET_KEY?.trim() ?? process.env.STRIPE_SECRET_KEY?.trim();
  return key || null;
}

export function createPlatformStripeClient(): Stripe {
  const key = getPlatformStripeSecretKey();
  if (!key) {
    throw new Error("STRIPE_BILLING_SECRET_KEY or STRIPE_SECRET_KEY is not configured");
  }
  return createStripeClient(key);
}

export function getBillingWebhookSecret(): string | null {
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET?.trim();
  return secret || null;
}
