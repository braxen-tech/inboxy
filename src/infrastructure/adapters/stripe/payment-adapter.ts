import type {
  PaymentGateway,
  CheckoutInput,
  CheckoutLineItem,
  CheckoutResult,
  PaymentError,
  StripeWebhookEvent,
} from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { createStripeClient } from "./client";
import Stripe from "stripe";
import { logger } from "@/lib/logger";

export class StripePaymentAdapter implements PaymentGateway {
  async createCheckoutSession(input: CheckoutInput): Promise<Result<CheckoutResult, PaymentError>> {
    try {
      const stripe = createStripeClient(input.apiKey);

      const params: Record<string, unknown> = {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: input.lineItems.map((li) => ({
          price: li.priceId,
          quantity: li.quantity,
        })),
        metadata: input.metadata,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl ?? input.successUrl,
        ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
      };

      const session = await stripe.checkout.sessions.create(params as any);

      logger.info("Stripe checkout session created", {
        sessionId: session.id,
        url: session.url,
        status: session.status,
        paymentStatus: session.payment_status,
      });

      if (!session.url) {
        return Err({ code: "PROVIDER_ERROR", message: "Stripe não retornou URL de checkout." });
      }

      return Ok({ url: session.url, sessionId: session.id });
    } catch (error) {
      logger.error("Stripe createCheckoutSession failed", {
        error: error instanceof Error ? error.message : String(error),
        type: (error as any)?.type,
        code: (error as any)?.code,
      });
      return Err(mapPaymentError(error));
    }
  }

  async createPaymentLink(
    apiKey: string,
    lineItems: CheckoutLineItem[],
  ): Promise<Result<string, PaymentError>> {
    try {
      const stripe = createStripeClient(apiKey);

      const link = await stripe.paymentLinks.create({
        line_items: lineItems.map((li) => ({
          price: li.priceId,
          quantity: li.quantity,
        })),
      });

      return Ok(link.url);
    } catch (error) {
      return Err(mapPaymentError(error));
    }
  }

  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Result<StripeWebhookEvent, PaymentError> {
    try {
      const event = Stripe.webhooks.constructEvent(payload, signature, secret);
      return Ok({
        id: event.id,
        type: event.type,
        data: { object: event.data.object as unknown as Record<string, unknown> },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Assinatura de webhook inválida.";
      return Err({ code: "INVALID_PARAMS", message });
    }
  }
}

function mapPaymentError(error: unknown): PaymentError {
  if (error && typeof error === "object" && "type" in error) {
    const stripeErr = error as { type: string; message?: string };
    if (stripeErr.type === "StripeAuthenticationError") {
      return { code: "AUTH_FAILED", message: "Chave da API do Stripe inválida." };
    }
    if (stripeErr.type === "StripeInvalidRequestError") {
      return { code: "INVALID_PARAMS", message: stripeErr.message ?? "Parâmetros inválidos." };
    }
    return { code: "PROVIDER_ERROR", message: stripeErr.message ?? "Erro ao processar pagamento." };
  }
  return { code: "PROVIDER_ERROR", message: "Erro inesperado ao processar pagamento." };
}
