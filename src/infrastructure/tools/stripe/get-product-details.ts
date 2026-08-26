import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError, ProductCatalog } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";

const inputSchema = z.object({
  productId: z.string().describe("ID do produto (UUID do bloco da loja)"),
});

export class GetProductDetailsTool implements AgentTool {
  name = "get_product_details";
  description =
    "Obtém detalhes completos de um produto específico: descrição, preço e imagens.";
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
      return Err({ code: "EXECUTION_FAILED", message: result.error.message });
    }

    const p = result.value;
    const lines: string[] = [`Nome: ${p.name}`, `ID: ${p.id}`];

    if (p.description) lines.push(`Descrição: ${p.description}`);

    if (p.defaultPrice) {
      const price = `R$ ${(p.defaultPrice.unitAmount / 100).toFixed(2).replace(".", ",")}`;
      lines.push(`Preço: ${price}`);
      if (p.defaultPrice.recurring) {
        lines.push(`Recorrência: ${p.defaultPrice.recurring.interval}`);
      }
    } else {
      lines.push("Preço: sob consulta");
    }

    if (p.images.length > 0) {
      lines.push(`Imagens: ${p.images.join(", ")}`);
    }

    return Ok(lines.join("\n"));
  }
}
