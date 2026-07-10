import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

const inputSchema = z.object({});

type OrderStatus = "draft" | "checkout" | "paid" | "cancelled" | "expired";

interface OrderWithItems {
  id: string;
  status: OrderStatus;
  total_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
  checkout_url: string | null;
  order_items: Array<{
    product_name: string;
    quantity: number;
    unit_amount: number;
  }>;
}

export class CheckOrderStatusTool implements AgentTool {
  name = "check_order_status";
  description =
    "Verifica o status do pedido/pagamento mais recente desta conversa. Use quando o cliente perguntar sobre o status do pagamento ou se já pagou.";
  inputSchema = inputSchema;

  constructor(private db: SupabaseClient) {}

  async execute(ctx: ToolContext): Promise<Result<string, ToolError>> {
    if (!ctx.stripe) {
      return Err({ code: "EXECUTION_FAILED", message: "Loja não configurada." });
    }

    const { data: order } = await this.db
      .from("orders")
      .select(
        `
        id,
        status,
        total_amount,
        currency,
        created_at,
        updated_at,
        checkout_url,
        order_items (
          product_name,
          quantity,
          unit_amount
        )
      `,
      )
      .eq("conversation_id", ctx.conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<OrderWithItems>();

    if (!order) {
      return Ok("Nenhum pedido encontrado nesta conversa.");
    }

    const items = order.order_items ?? [];
    const itemsSummary =
      items.length > 0
        ? items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ")
        : "Nenhum item";

    const total = order.total_amount / 100;
    const totalFormatted = `R$ ${total.toFixed(2).replace(".", ",")}`;

    switch (order.status) {
      case "paid":
        return Ok(
          `PAGAMENTO CONFIRMADO!\n` +
            `Pedido: ${itemsSummary}\n` +
            `Valor: ${totalFormatted}\n` +
            `O cliente JÁ PAGOU. Você pode prosseguir com os próximos passos (ex: agendar reunião, enviar informações, etc).`,
        );

      case "checkout":
        return Ok(
          `Pedido aguardando pagamento.\n` +
            `Pedido: ${itemsSummary}\n` +
            `Valor: ${totalFormatted}\n` +
            `Link de pagamento já foi enviado. Se o cliente disse que pagou, aguarde alguns instantes e verifique novamente, pois a confirmação pode levar alguns segundos.`,
        );

      case "draft":
        return Ok(
          `Pedido em rascunho (carrinho).\n` +
            `Itens: ${itemsSummary}\n` +
            `Valor: ${totalFormatted}\n` +
            `O cliente ainda não finalizou a compra. Use create_checkout para gerar o link de pagamento.`,
        );

      case "expired":
        return Ok(
          `Link de pagamento expirou.\n` +
            `Pedido: ${itemsSummary}\n` +
            `Valor: ${totalFormatted}\n` +
            `Se o cliente ainda quiser comprar, será necessário criar um novo checkout.`,
        );

      case "cancelled":
        return Ok(
          `Pagamento cancelado.\n` +
            `Pedido: ${itemsSummary}\n` +
            `Valor: ${totalFormatted}\n` +
            `Se o cliente quiser tentar novamente, será necessário criar um novo checkout.`,
        );

      default:
        return Ok(`Status do pedido: ${order.status}`);
    }
  }
}
