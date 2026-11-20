import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError, PaymentGateway, ProductCatalog, CheckoutLineItem } from "@/domain/ports";
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
    private catalog: ProductCatalog,
  ) {}

  async execute(ctx: ToolContext): Promise<Result<string, ToolError>> {
    if (!ctx.payment) {
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

    // Price and recurrence come from Stripe at checkout time, not from the cart snapshot.
    const lineItems: CheckoutLineItem[] = [];
    for (const i of items) {
      const product = await this.catalog.getProduct(ctx.orgId, i.product_id);
      if (!product.ok || !product.value.defaultPrice) {
        return Err({
          code: "EXECUTION_FAILED",
          message: `O produto "${i.product_name}" não está mais disponível. Remova do carrinho e ofereça outro.`,
        });
      }
      const price = product.value.defaultPrice;
      lineItems.push({
        productId: i.product_id,
        productName: product.value.name,
        quantity: i.quantity,
        unitAmountBrl: price.unitAmount / 100,
        ...(price.recurring ? { recurring: price.recurring } : {}),
      });
    }

    const periods = new Set(
      lineItems.filter((l) => l.recurring).map((l) => `${l.recurring!.interval}:${l.recurring!.intervalCount}`),
    );
    if (periods.size > 1) {
      return Err({
        code: "EXECUTION_FAILED",
        message: "O carrinho tem assinaturas com períodos diferentes. Finalize uma assinatura por vez.",
      });
    }

    const result = await this.paymentGateway.createCheckoutSession({
      stripeAccountId: ctx.payment.stripeAccountId,
      lineItems,
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
        stripe_checkout_session_id: paymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    const total = lineItems.reduce((sum, l) => sum + l.unitAmountBrl * l.quantity, 0);
    const recurring = lineItems.find((l) => l.recurring)?.recurring;
    const recurringNote = recurring
      ? `\nÉ uma ASSINATURA: o cliente será cobrado de novo a cada ${recurring.intervalCount > 1 ? `${recurring.intervalCount} ` : ""}${{ day: "dia(s)", week: "semana(s)", month: "mês(es)", year: "ano(s)" }[recurring.interval]}. Avise isso ao cliente.`
      : "";

    return Ok(
      `LINK DE PAGAMENTO GERADO COM SUCESSO.\nTotal: R$ ${total.toFixed(2).replace(".", ",")}\nURL (OBRIGATÓRIO enviar este link exato ao cliente): ${url}\n${recurring ? "Assinaturas são pagas com cartão de crédito." : "O cliente pode pagar via PIX, boleto ou cartão de crédito."}${recurringNote}`,
    );
  }
}
