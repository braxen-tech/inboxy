import type { Result } from "../errors";

export interface CheckoutLineItem {
  priceId: string;
  quantity: number;
}

export interface CheckoutInput {
  apiKey: string;
  lineItems: CheckoutLineItem[];
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl?: string;
  customerEmail?: string;
}

export interface CheckoutResult {
  url: string;
  sessionId: string;
}

export type PaymentError = {
  code: "AUTH_FAILED" | "INVALID_PARAMS" | "PROVIDER_ERROR";
  message: string;
};

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

export interface PaymentGateway {
  createCheckoutSession(input: CheckoutInput): Promise<Result<CheckoutResult, PaymentError>>;
  createPaymentLink(apiKey: string, lineItems: CheckoutLineItem[]): Promise<Result<string, PaymentError>>;
  verifyWebhookSignature(payload: string, signature: string, secret: string): Result<StripeWebhookEvent, PaymentError>;
}
