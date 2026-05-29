import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError, ProductCatalog } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";

const inputSchema = z.object({
  productId: z.string().describe("ID do produto no Stripe (ex: prod_xxx)"),
});

export class GetProductDetailsTool implements AgentTool {
  name = "get_product_details";
  description =
    "Obtém detalhes completos de um produto específico: descrição, preço, imagens e metadados.";
  inputSchema = inputSchema;

  constructor(private catalog: ProductCatalog) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    if (!ctx.stripe) {
      return Err({ code: "EXECUTION_FAILED", message: "Loja não configurada para esta organização." });
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

    const p = result.value;
    const lines: string[] = [
      `Nome: ${p.name}`,
      `ID: ${p.id}`,
    ];

    if (p.description) lines.push(`Descrição: ${p.description}`);

    if (p.defaultPrice) {
      const price = formatPrice(p.defaultPrice.unitAmount, p.defaultPrice.currency);
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

    const relevantMeta = Object.entries(p.metadata).filter(
      ([k]) => !k.startsWith("_"),
    );
    if (relevantMeta.length > 0) {
      lines.push(`Info adicional: ${relevantMeta.map(([k, v]) => `${k}=${v}`).join(", ")}`);
    }

    return Ok(lines.join("\n"));
  }
}

function formatPrice(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  if (currency === "brl") return `R$ ${amount.toFixed(2).replace(".", ",")}`;
  return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
}
