import type { PaymentGateway, CheckoutInput, CheckoutResult, PaymentError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { createPaymentLink, AsaasApiError } from "./client";
import { logger } from "@/lib/logger";

export class AsaasPaymentAdapter implements PaymentGateway {
  async createCheckoutSession(input: CheckoutInput): Promise<Result<CheckoutResult, PaymentError>> {
    try {
      const totalBrl = input.lineItems.reduce(
        (sum, item) => sum + (item.unitAmountBrl ?? 0) * item.quantity,
        0,
      );

      if (totalBrl <= 0) {
        return Err({ code: "INVALID_PARAMS", message: "Valor do pedido inválido (R$ 0,00)." });
      }

      const orderId = input.metadata.orderId ?? "";
      const itemNames = input.lineItems.map((i) => `${i.quantity}x ${i.productName}`).join(", ");

      const link = await createPaymentLink(input.apiKey, {
        name: `Pedido ${orderId.slice(0, 8).toUpperCase()}`,
        description: itemNames,
        billingType: "UNDEFINED",
        chargeType: "DETACHED",
        value: Math.round(totalBrl * 100) / 100,
        externalReference: orderId,
      });

      logger.info("Asaas payment link created", {
        orgId: input.metadata.orgId,
        orderId,
        linkId: link.id,
        value: totalBrl,
      });

      return Ok({ url: link.url, paymentId: link.id });
    } catch (error) {
      if (error instanceof AsaasApiError) {
        if (error.status === 401 || error.status === 403) {
          return Err({ code: "AUTH_FAILED", message: "Chave da API Asaas inválida ou expirada." });
        }
        if (error.status === 400) {
          return Err({ code: "INVALID_PARAMS", message: `Parâmetros inválidos: ${JSON.stringify(error.body)}` });
        }
        return Err({ code: "PROVIDER_ERROR", message: `Asaas error ${error.status}` });
      }
      logger.error("AsaasPaymentAdapter.createCheckoutSession failed", { error: String(error) });
      return Err({ code: "PROVIDER_ERROR", message: "Erro ao criar link de pagamento." });
    }
  }
}
