import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError, PaymentGateway } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const inputSchema = z.object({
  customerEmail: z.string().email().optional().describe("E-mail do cliente (opcional, para recibo)"),
});

export class CreateCheckoutTool implements AgentTool {
  name = "create_checkout";
  description =
    "Gera um link de pagamento para o carrinho atual do cliente. Envia o link para o cliente finalizar a compra no navegador.";
  inputSchema = inputSchema;

  constructor(
    private db: SupabaseClient,
    private paymentGateway: PaymentGateway,
    private appUrl: string,
  ) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    if (!ctx.stripe) {
      return Err({ code: "EXECUTION_FAILED", message: "Loja não configurada." });
    }

    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Parâmetros inválidos." });
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
      .select("stripe_price_id, quantity")
      .eq("order_id", order.id);

    if (!items || items.length === 0) {
      return Err({ code: "EXECUTION_FAILED", message: "Carrinho vazio." });
    }

    const result = await this.paymentGateway.createCheckoutSession({
      apiKey: ctx.stripe.apiKey,
      lineItems: items.map((i) => ({ priceId: i.stripe_price_id, quantity: i.quantity })),
      metadata: {
        orgId: order.organization_id,
        conversationId: ctx.conversationId,
        contactId: order.contact_id,
        orderId: order.id,
      },
      successUrl: `${this.appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${this.appUrl}/checkout/cancelled`,
      customerEmail: parsed.data.customerEmail,
    });

    if (!result.ok) {
      logger.error("create_checkout: Stripe error", {
        orgId: ctx.orgId,
        conversationId: ctx.conversationId,
        error: result.error,
      });
      if (result.error.code === "AUTH_FAILED") {
        return Err({ code: "EXECUTION_FAILED", message: "Credencial de pagamento expirada. Contate o suporte." });
      }
      return Err({ code: "EXECUTION_FAILED", message: `Erro ao gerar link: ${result.error.message}` });
    }

    const { url, sessionId } = result.value;

    await this.db
      .from("orders")
      .update({
        status: "checkout",
        stripe_checkout_session_id: sessionId,
        checkout_url: url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    const total = order.total_amount / 100;

    return Ok(
      `LINK DE PAGAMENTO GERADO COM SUCESSO.\nTotal: R$ ${total.toFixed(2).replace(".", ",")}\nURL (OBRIGATÓRIO enviar este link exato ao cliente): ${url}\nO link expira em 30 minutos. Envie a URL completa na sua resposta.`,
    );
  }
}
