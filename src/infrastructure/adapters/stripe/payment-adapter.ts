import type { PaymentGateway, CheckoutInput, CheckoutResult, PaymentError } from "@/domain/ports/payment-gateway";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { getStripe } from "./client";
import { logger } from "@/lib/logger";

function platformFeeAmount(totalAmountCents: number): number {
  const feePct = Number(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "10");
  return Math.round(totalAmountCents * (feePct / 100));
}

export class StripePaymentAdapter implements PaymentGateway {
  async createCheckoutSession(
    input: CheckoutInput,
  ): Promise<Result<CheckoutResult, PaymentError>> {
    const { stripeAccountId, lineItems, metadata, mode = "payment", discountPromoCodeId, allowPromoCodes } = input;

    if (!stripeAccountId) {
      return Err({ code: "AUTH_FAILED", message: "Stripe Connected Account ID not configured." });
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.inboxy.io";

    try {
      const totalAmountCents = lineItems.reduce(
        (sum, item) => sum + Math.round(item.unitAmountBrl * 100) * item.quantity,
        0,
      );
      const feeAmount = platformFeeAmount(totalAmountCents);

      const isSubscription = mode === "subscription";

      const session = await stripe.checkout.sessions.create({
        mode,
        line_items: lineItems.map((item) => ({
          price_data: {
            currency: "brl",
            unit_amount: Math.round(item.unitAmountBrl * 100),
            product_data: {
              name: item.productName,
              metadata: { productId: item.productId },
            },
            ...(isSubscription ? { recurring: { interval: "month" } } : {}),
          },
          quantity: item.quantity,
        })),
        ...(isSubscription
          ? {
              subscription_data: {
                application_fee_percent: Number(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "10"),
                transfer_data: { destination: stripeAccountId },
                metadata,
              },
            }
          : {
              payment_intent_data: {
                application_fee_amount: feeAmount,
                transfer_data: { destination: stripeAccountId },
              },
            }),
        success_url: `${appUrl}/store/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/store/cancel`,
        metadata,
        ...(discountPromoCodeId
          ? { discounts: [{ promotion_code: discountPromoCodeId }] }
          : allowPromoCodes
            ? { allow_promotion_codes: true }
            : {}),
      });

      if (!session.url) {
        return Err({ code: "PROVIDER_ERROR", message: "Stripe did not return a checkout URL." });
      }

      return Ok({ url: session.url, paymentId: session.id });
    } catch (error) {
      logger.error("Stripe checkout session creation failed", {
        stripeAccountId,
        error: String(error),
      });
      return Err({ code: "PROVIDER_ERROR", message: "Falha ao criar checkout Stripe." });
    }
  }
}
