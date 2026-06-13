import { z } from "zod/v4";
import type { AgentTool, ToolContext, ToolError } from "@/domain/ports";
import type { KnowledgeRetriever } from "@/domain/ports/knowledge-retriever";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";

const inputSchema = z.object({
  query: z.string().min(1).describe("Pergunta ou termos para buscar na base de conhecimento"),
  limit: z.number().int().min(1).max(10).optional().describe("Número máximo de trechos (padrão 5)"),
});

export class LookupKnowledgeTool implements AgentTool {
  name = "lookup_knowledge";
  description =
    "Busca trechos relevantes nos documentos da base de conhecimento. Use antes de responder perguntas factuais sobre produtos, serviços, preços, políticas ou procedimentos.";
  inputSchema = inputSchema;

  constructor(private retriever: KnowledgeRetriever) {}

  async execute(ctx: ToolContext, input: unknown): Promise<Result<string, ToolError>> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return Err({
        code: "VALIDATION_FAILED",
        message: "Informe uma query de busca válida.",
      });
    }

    const limit = parsed.data.limit ?? 5;
    const result = await this.retriever.retrieve(ctx.orgId, parsed.data.query, limit);

    if (!result.ok) {
      return Err({
        code: "EXECUTION_FAILED",
        message: "Não foi possível consultar a base de conhecimento no momento.",
      });
    }

    if (result.value.length === 0) {
      return Ok("Nenhum trecho relevante encontrado nos documentos indexados.");
    }

    const formatted = result.value
      .map(
        (chunk, index) =>
          `[${index + 1}] (${chunk.documentTitle}, relevância ${chunk.score.toFixed(2)})\n${chunk.content}`,
      )
      .join("\n\n");

    return Ok(formatted);
  }
}
