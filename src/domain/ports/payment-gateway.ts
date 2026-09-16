import type { Result } from "../errors";

export interface CheckoutLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitAmountBrl: number; // in BRL, e.g. 97.50
}

export interface CheckoutInput {
  stripeAccountId: string;
  lineItems: CheckoutLineItem[];
  metadata: Record<string, string>;
  /** "payment" (default) or "subscription" for recurring courses */
  mode?: "payment" | "subscription";
  /** Pre-apply this Stripe PromotionCode ID (from connected account) — mutually exclusive with allowPromoCodes */
  discountPromoCodeId?: string;
  /** Show native promo code field in Stripe Checkout */
  allowPromoCodes?: boolean;
}

export interface CheckoutResult {
  url: string;
  paymentId: string;
}

export type PaymentError = {
  code: "AUTH_FAILED" | "INVALID_PARAMS" | "PROVIDER_ERROR";
  message: string;
};

export interface PaymentGateway {
  createCheckoutSession(input: CheckoutInput): Promise<Result<CheckoutResult, PaymentError>>;
}
