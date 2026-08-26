import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError, PaymentGateway } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const inputSchema = z.object({});

export class CreateCheckoutTool implements AgentTool {
  name = "create_checkout";
  description =
    "Gera um link de pagamento (PIX, boleto ou cartão) para o carrinho atual do cliente. Envie o link para o cliente finalizar a compra.";
  inputSchema = inputSchema;

  constructor(
    private db: SupabaseClient,
    private paymentGateway: PaymentGateway,
  ) {}

  async execute(ctx: ToolContext): Promise<Result<string, ToolError>> {
    if (!ctx.asaas) {
      return Err({ code: "EXECUTION_FAILED", message: "Loja não configurada." });
    }

    const { data: order } = await this.db
      .from("orders")
      .select("id, organization_id, contact_id, total_amount")
      .eq("conversation_id", ctx.conversationId)
      .eq("status", "draft")
      .maybeSingle();

    if (!order) {
      return Err({ code: "EXECUTION_FAILED", message: "Carrinho vazio. Adicione produtos antes de finalizar." });
    }

    const { data: items } = await this.db
      .from("order_items")
      .select("product_id, product_name, quantity, unit_amount")
      .eq("order_id", order.id);

    if (!items || items.length === 0) {
      return Err({ code: "EXECUTION_FAILED", message: "Carrinho vazio." });
    }

    const result = await this.paymentGateway.createCheckoutSession({
      apiKey: ctx.asaas.apiKey,
      lineItems: items.map((i) => ({
        productId: i.product_id,
        productName: i.product_name,
        quantity: i.quantity,
        unitAmountBrl: i.unit_amount / 100,
      })),
      metadata: {
        orgId: order.organization_id,
        conversationId: ctx.conversationId,
        contactId: order.contact_id,
        orderId: order.id,
      },
    });

    if (!result.ok) {
      logger.error("create_checkout: payment gateway error", {
        orgId: ctx.orgId,
        conversationId: ctx.conversationId,
        error: result.error,
      });
      if (result.error.code === "AUTH_FAILED") {
        return Err({ code: "EXECUTION_FAILED", message: "Credencial de pagamento expirada. Contate o suporte." });
      }
      return Err({ code: "EXECUTION_FAILED", message: `Erro ao gerar link: ${result.error.message}` });
    }

    const { url, paymentId } = result.value;

    await this.db
      .from("orders")
      .update({
        status: "checkout",
        asaas_payment_id: paymentId,
        asaas_payment_link: url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    const total = order.total_amount / 100;

    return Ok(
      `LINK DE PAGAMENTO GERADO COM SUCESSO.\nTotal: R$ ${total.toFixed(2).replace(".", ",")}\nURL (OBRIGATÓRIO enviar este link exato ao cliente): ${url}\nO cliente pode pagar via PIX, boleto ou cartão de crédito.`,
    );
  }
}
