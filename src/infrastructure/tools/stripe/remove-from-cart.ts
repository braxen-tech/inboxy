import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

const inputSchema = z.object({
  productName: z.string().describe("Nome do produto a remover do carrinho"),
});

export class RemoveFromCartTool implements AgentTool {
  name = "remove_from_cart";
  description = "Remove um produto do carrinho do cliente. Informe o nome do produto.";
  inputSchema = inputSchema;

  constructor(private db: SupabaseClient) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    if (!ctx.stripe) {
      return Err({ code: "EXECUTION_FAILED", message: "Loja não configurada." });
    }

    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Informe o nome do produto." });
    }

    const { data: order } = await this.db
      .from("orders")
      .select("id")
      .eq("conversation_id", ctx.conversationId)
      .eq("status", "draft")
      .maybeSingle();

    if (!order) {
      return Ok("O carrinho está vazio, nada para remover.");
    }

    const { data: items } = await this.db
      .from("order_items")
      .select("id, product_name")
      .eq("order_id", order.id);

    if (!items || items.length === 0) {
      return Ok("O carrinho está vazio, nada para remover.");
    }

    const match = items.find(
      (i) => i.product_name.toLowerCase().includes(parsed.data.productName.toLowerCase()),
    );

    if (!match) {
      const available = items.map((i) => i.product_name).join(", ");
      return Err({
        code: "EXECUTION_FAILED",
        message: `Produto "${parsed.data.productName}" não encontrado no carrinho. Itens atuais: ${available}`,
      });
    }

    await this.db.from("order_items").delete().eq("id", match.id);

    const { data: remaining } = await this.db
      .from("order_items")
      .select("quantity, unit_amount")
      .eq("order_id", order.id);

    const total = (remaining ?? []).reduce((sum, i) => sum + i.quantity * i.unit_amount, 0);

    await this.db
      .from("orders")
      .update({ total_amount: total, updated_at: new Date().toISOString() })
      .eq("id", order.id);

    if (!remaining || remaining.length === 0) {
      await this.db.from("orders").delete().eq("id", order.id);
      return Ok(`"${match.product_name}" removido. O carrinho agora está vazio.`);
    }

    return Ok(
      `"${match.product_name}" removido. Restam ${remaining.length} item(s), total R$ ${(total / 100).toFixed(2).replace(".", ",")}`,
    );
  }
}
