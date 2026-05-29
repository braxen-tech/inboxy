import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

const inputSchema = z.object({});

export class ViewCartTool implements AgentTool {
  name = "view_cart";
  description = "Mostra os itens no carrinho atual do cliente nesta conversa.";
  inputSchema = inputSchema;

  constructor(private db: SupabaseClient) {}

  async execute(ctx: ToolContext): Promise<Result<string, ToolError>> {
    if (!ctx.stripe) {
      return Err({ code: "EXECUTION_FAILED", message: "Loja não configurada." });
    }

    const { data: order } = await this.db
      .from("orders")
      .select("id, total_amount, currency")
      .eq("conversation_id", ctx.conversationId)
      .eq("status", "draft")
      .maybeSingle();

    if (!order) {
      return Ok("O carrinho está vazio.");
    }

    const { data: items } = await this.db
      .from("order_items")
      .select("product_name, quantity, unit_amount, stripe_price_id")
      .eq("order_id", order.id);

    if (!items || items.length === 0) {
      return Ok("O carrinho está vazio.");
    }

    const lines: string[] = ["Itens no carrinho:\n"];
    for (const item of items) {
      const subtotal = (item.quantity * item.unit_amount) / 100;
      lines.push(
        `• ${item.quantity}x ${item.product_name} - R$ ${subtotal.toFixed(2).replace(".", ",")}`,
      );
    }

    const total = order.total_amount / 100;
    lines.push(`\nTotal: R$ ${total.toFixed(2).replace(".", ",")}`);

    return Ok(lines.join("\n"));
  }
}
