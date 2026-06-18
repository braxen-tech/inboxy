import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError, ProductCatalog } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const inputSchema = z.object({
  productId: z.string().describe("ID do produto no Stripe (prod_xxx)"),
  quantity: z.number().int().min(1).default(1).describe("Quantidade desejada"),
});

export class AddToCartTool implements AgentTool {
  name = "add_to_cart";
  description =
    "Adiciona um produto ao carrinho do cliente. Informe apenas o product_id (prod_xxx) e a quantidade. O preço é obtido automaticamente do Stripe.";
  inputSchema = inputSchema;

  constructor(
    private db: SupabaseClient,
    private catalog: ProductCatalog,
  ) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    if (!ctx.stripe) {
      return Err({ code: "EXECUTION_FAILED", message: "Loja não configurada." });
    }

    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Dados do produto inválidos." });
    }

    const { productId, quantity } = parsed.data;
    const logCtx = { orgId: ctx.orgId, conversationId: ctx.conversationId };

    logger.info("add_to_cart: looking up product", { ...logCtx, productId });

    const productResult = await this.catalog.getProduct(ctx.stripe.apiKey, productId);
    if (!productResult.ok) {
      logger.error("add_to_cart: product lookup failed", { ...logCtx, productId, error: productResult.error });
      return Err({ code: "EXECUTION_FAILED", message: `Produto não encontrado: ${productResult.error.message}` });
    }

    const product = productResult.value;
    if (!product.defaultPrice) {
      logger.error("add_to_cart: product has no default price", { ...logCtx, productId });
      return Err({ code: "EXECUTION_FAILED", message: "Produto sem preço configurado." });
    }

    const priceId = product.defaultPrice.id;
    const unitAmount = product.defaultPrice.unitAmount;
    const productName = product.name;
    logger.info("add_to_cart: resolved price", { ...logCtx, productId, priceId, unitAmount, productName });

    const { data: existingOrder } = await this.db
      .from("orders")
      .select("id")
      .eq("conversation_id", ctx.conversationId)
      .eq("status", "draft")
      .maybeSingle();

    let orderId: string;

    if (existingOrder) {
      orderId = existingOrder.id;
    } else {
      const { data: conversation, error: convErr } = await this.db
        .from("conversations")
        .select("contact_id")
        .eq("id", ctx.conversationId)
        .single();

      if (convErr || !conversation) {
        logger.error("add_to_cart: conversation not found", { ...logCtx, error: convErr });
        return Err({ code: "EXECUTION_FAILED", message: "Conversa não encontrada." });
      }

      const { data: newOrder, error: orderErr } = await this.db
        .from("orders")
        .insert({
          organization_id: ctx.orgId,
          conversation_id: ctx.conversationId,
          contact_id: conversation.contact_id,
          status: "draft",
          currency: "brl",
        })
        .select("id")
        .single();

      if (orderErr || !newOrder) {
        return Err({ code: "EXECUTION_FAILED", message: "Erro ao criar pedido." });
      }
      orderId = newOrder.id;
    }

    const { data: existingItem } = await this.db
      .from("order_items")
      .select("id, quantity")
      .eq("order_id", orderId)
      .eq("stripe_price_id", priceId)
      .maybeSingle();

    if (existingItem) {
      await this.db
        .from("order_items")
        .update({ quantity: existingItem.quantity + quantity })
        .eq("id", existingItem.id);
    } else {
      const { error: itemErr } = await this.db.from("order_items").insert({
        order_id: orderId,
        stripe_product_id: productId,
        stripe_price_id: priceId,
        product_name: productName,
        unit_amount: unitAmount,
        quantity,
      });

      if (itemErr) {
        return Err({ code: "EXECUTION_FAILED", message: "Erro ao adicionar item." });
      }
    }

    await recalculateTotal(this.db, orderId);

    const { data: items } = await this.db
      .from("order_items")
      .select("product_name, quantity, unit_amount")
      .eq("order_id", orderId);

    const total = (items ?? []).reduce((sum, i) => sum + i.quantity * i.unit_amount, 0);
    const itemCount = (items ?? []).reduce((sum, i) => sum + i.quantity, 0);

    return Ok(
      `Adicionado: ${quantity}x ${productName}. Carrinho: ${itemCount} item(s), total R$ ${(total / 100).toFixed(2).replace(".", ",")}`,
    );
  }
}

async function recalculateTotal(db: SupabaseClient, orderId: string) {
  const { data: items } = await db
    .from("order_items")
    .select("quantity, unit_amount")
    .eq("order_id", orderId);

  const total = (items ?? []).reduce((sum, i) => sum + i.quantity * i.unit_amount, 0);

  await db.from("orders").update({ total_amount: total, updated_at: new Date().toISOString() }).eq("id", orderId);
}
