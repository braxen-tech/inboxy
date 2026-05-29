import Stripe from "stripe";

const API_VERSION = "2026-05-27.dahlia" as const;

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: API_VERSION,
    typescript: true,
    maxNetworkRetries: 2,
  });
}
