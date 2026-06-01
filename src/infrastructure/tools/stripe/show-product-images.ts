import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError, ProductCatalog } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { ChatwootClient } from "@/infrastructure/adapters/chatwoot/client";

const inputSchema = z.object({
  productId: z.string().describe("ID do produto no Stripe (ex: prod_xxx)"),
  caption: z.string().optional().describe("Legenda opcional para enviar junto das imagens"),
});

export class ShowProductImagesTool implements AgentTool {
  name = "show_product_images";
  description =
    "Envia as imagens de um produto diretamente no chat para o cliente visualizar. Use quando o cliente pedir para ver fotos/imagens de um produto.";
  inputSchema = inputSchema;

  constructor(private catalog: ProductCatalog) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    if (!ctx.stripe) {
      return Err({ code: "EXECUTION_FAILED", message: "Loja não configurada para esta organização." });
    }

    if (!ctx.chatwoot) {
      return Err({ code: "EXECUTION_FAILED", message: "Canal de mensagens não configurado." });
    }

    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Informe o productId." });
    }

    const result = await this.catalog.getProduct(ctx.stripe.apiKey, parsed.data.productId);

    if (!result.ok) {
      if (result.error.code === "AUTH_FAILED") {
        return Err({ code: "EXECUTION_FAILED", message: "Credencial da loja expirada." });
      }
      return Err({ code: "EXECUTION_FAILED", message: result.error.message });
    }

    const product = result.value;

    if (product.images.length === 0) {
      return Ok("Este produto não possui imagens cadastradas.");
    }

    const client = new ChatwootClient(ctx.chatwoot.apiUrl, ctx.chatwoot.apiToken);
    let sentCount = 0;

    for (const imageUrl of product.images) {
      const caption = sentCount === 0 ? (parsed.data.caption ?? "") : "";
      const sendResult = await client.sendMessageWithAttachment(
        ctx.chatwoot.accountId,
        ctx.chatwoot.conversationId,
        caption,
        imageUrl,
      );

      if (sendResult.ok) {
        sentCount++;
      }
    }

    if (sentCount === 0) {
      return Err({ code: "EXECUTION_FAILED", message: "Não foi possível enviar as imagens." });
    }

    return Ok(`${sentCount} imagem(ns) de "${product.name}" enviada(s) ao cliente.`);
  }
}
