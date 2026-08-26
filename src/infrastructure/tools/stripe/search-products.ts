import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError, ProductCatalog } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";

const inputSchema = z.object({
  query: z.string().optional().describe("Termo de busca para filtrar produtos por nome ou descrição"),
});

export class SearchProductsTool implements AgentTool {
  name = "search_products";
  description =
    "Busca produtos disponíveis no catálogo da loja. Retorna até 20 produtos com nome, preço e descrição curta. Use sem query para listar todos ou com query para filtrar.";
  inputSchema = inputSchema;

  constructor(private catalog: ProductCatalog) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    if (!ctx.asaas) {
      return Err({ code: "EXECUTION_FAILED", message: "Loja não configurada para esta organização." });
    }

    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({ code: "VALIDATION_FAILED", message: "Parâmetros inválidos." });
    }

    const result = await this.catalog.listProducts(ctx.orgId, {
      query: parsed.data.query,
      limit: 20,
    });

    if (!result.ok) {
      return Err({ code: "EXECUTION_FAILED", message: "Não foi possível consultar os produtos no momento." });
    }

    if (result.value.length === 0) {
      return Ok("Nenhum produto encontrado.");
    }

    const lines: string[] = [`${result.value.length} produto(s) encontrado(s):\n`];
    for (const p of result.value) {
      const price = p.defaultPrice
        ? `R$ ${(p.defaultPrice.unitAmount / 100).toFixed(2).replace(".", ",")}`
        : "Preço sob consulta";
      const desc = p.description ? ` — ${p.description.slice(0, 80)}` : "";
      lines.push(`• ${p.name} | product_id: ${p.id} | ${price}${desc}`);
    }

    return Ok(lines.join("\n"));
  }
}
