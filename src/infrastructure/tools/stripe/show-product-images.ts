import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError, ProductCatalog } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";

const inputSchema = z.object({
  productId: z.string().describe("ID do produto (ex: prod_xxx)"),
  caption: z.string().optional().describe("Legenda opcional para enviar junto das imagens"),
});

export class ShowProductImagesTool implements AgentTool {
  name = "show_product_images";
  description =
    "Lista as URLs das imagens de um produto para o cliente visualizar. Use quando o cliente pedir para ver fotos/imagens de um produto.";
  inputSchema = inputSchema;

  constructor(private catalog: ProductCatalog) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    if (!ctx.asaas) {
      return Err({ code: "EXECUTION_FAILED", message: "Loja não configurada para esta organização." });
    }

    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Informe o productId." });
    }

    const result = await this.catalog.getProduct(ctx.orgId, parsed.data.productId);

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

    const lines = [`Imagens de "${product.name}":`];
    for (const url of product.images) {
      lines.push(url);
    }
    if (parsed.data.caption) {
      lines.push(parsed.data.caption);
    }

    return Ok(lines.join("\n"));
  }
}
