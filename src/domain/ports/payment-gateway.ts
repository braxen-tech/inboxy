import type { Result } from "../errors";

export interface CheckoutLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitAmountBrl: number; // in BRL, e.g. 97.50
}

export interface CheckoutInput {
  apiKey: string;
  lineItems: CheckoutLineItem[];
  metadata: Record<string, string>;
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
