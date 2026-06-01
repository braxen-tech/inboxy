import { generateText, stepCountIs, tool, type ToolSet } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { AgentRunner, AgentRunParams, AgentOutput, AgentError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { logger } from "@/lib/logger";

const AGENT_TIMEOUT_MS = 45_000;
const AGENT_TIMEOUT_WITH_TOOLS_MS = 60_000;
const MAX_STEPS_WITH_TOOLS = 5;

export class ClaudeAdapter implements AgentRunner {
  async run(params: AgentRunParams): Promise<Result<AgentOutput, AgentError>> {
    const { systemPrompt, knowledgeBase, history, tools, toolContext, model, language } = params;

    const hasTools = tools.length > 0;
    const timeoutMs = hasTools ? AGENT_TIMEOUT_WITH_TOOLS_MS : AGENT_TIMEOUT_MS;

    const now = new Date();
    const currentDateStr = now.toLocaleDateString("pt-BR", {
      timeZone: toolContext.calendar?.timezone ?? "America/Sao_Paulo",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const currentTimeStr = now.toLocaleTimeString("pt-BR", {
      timeZone: toolContext.calendar?.timezone ?? "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });

    const systemParts = [
      systemPrompt,
      "",
      `## Data e hora atual`,
      `Hoje é ${currentDateStr}, ${currentTimeStr} (fuso ${toolContext.calendar?.timezone ?? "America/Sao_Paulo"}).`,
      `Use sempre esta data como referência para interpretar "hoje", "amanhã", "semana que vem", etc.`,
      "",
      `## Base de Conhecimento`,
      knowledgeBase,
      "",
      `## Instruções operacionais`,
      `- Responda sempre em ${language}.`,
      `- Seja profissional, cordial e direto.`,
      `- Se não souber a resposta, diga que não sabe e oriente o paciente a entrar em contato pelo telefone do estabelecimento.`,
      `- Nunca invente informações que não estejam na base de conhecimento.`,
    ];

    if (toolContext.calendar) {
      systemParts.push("");
      systemParts.push(`## Instruções de agendamento`);
      systemParts.push(`- Quando o paciente demonstrar intenção de agendar ou perguntar sobre horários disponíveis, CHAME IMEDIATAMENTE a tool check_calendar_availability com a data desejada.`);
      systemParts.push(`- Apresente os horários disponíveis retornados pela tool no fuso ${toolContext.calendar.timezone}. Nunca invente horários.`);
      systemParts.push(`- Após o paciente escolher um horário, IMEDIATAMENTE peça apenas nome completo e e-mail para confirmar o agendamento (não peça "qual serviço").`);
      systemParts.push(`- Assim que receber nome e e-mail válidos, CHAME IMEDIATAMENTE book_calendar_appointment com esses dados.`);
      systemParts.push(`- Aguarde a resposta da tool com a confirmação de ID antes de confirmar ao paciente.`);
      if (toolContext.calendar.bookingUrl) {
        systemParts.push(`- Se o paciente recusar informar e-mail após 1 tentativa, ofereça APENAS o link: ${toolContext.calendar.bookingUrl}`);
      }
    }

    if (toolContext.stripe) {
      systemParts.push("");
      systemParts.push(`## Instruções de vendas e catálogo`);
      systemParts.push(`- Você tem acesso ao catálogo de produtos da loja via tools. SEMPRE use search_products para consultar produtos reais — NUNCA invente produtos ou preços.`);
      systemParts.push(`- Quando o cliente perguntar sobre produtos, preços ou quiser comprar algo, CHAME IMEDIATAMENTE search_products (com query se o cliente especificou algo, sem query para listar todos).`);
      systemParts.push(`- Apresente os produtos retornados de forma natural e amigável, incluindo nome e preço. Não mostre IDs internos ao cliente.`);
      systemParts.push(`- FLUXO OBRIGATÓRIO para detalhes: PRIMEIRO chame search_products para encontrar o produto e obter o ID (prod_xxx). DEPOIS use get_product_details com esse ID. NUNCA chame get_product_details sem ter o ID do produto.`);
      systemParts.push(`- Se o cliente pedir para ver fotos/imagens de um produto, use show_product_images com o ID do produto para enviar as imagens diretamente no chat.`);
      systemParts.push(`- Quando o cliente quiser comprar, use add_to_cart para adicionar ao carrinho. Confirme a adição.`);
      systemParts.push(`- Se o cliente pedir para ver o carrinho, use view_cart.`);
      systemParts.push(`- Se quiser remover algo, use remove_from_cart.`);
      systemParts.push(`- Quando o cliente confirmar que quer finalizar a compra, use create_checkout para gerar o link de pagamento.`);
      systemParts.push(`- IMPORTANTE: Quando create_checkout retornar a URL, você DEVE incluir a URL completa (https://...) na sua resposta ao cliente. NUNCA omita o link. O cliente precisa clicar nele para pagar.`);
      systemParts.push(`- O link de pagamento expira em 30 minutos. Informe isso ao cliente.`);
      systemParts.push(`- No checkout o cliente pode pagar com cartão ou PIX (se a loja tiver PIX ativo no Stripe). Para PIX, explique que ele verá o QR code na página do link.`);
    }

    const systemContent = systemParts.join("\n");

    const messages = history.map((msg, i) => ({
      role: msg.direction === "inbound" ? "user" as const : "assistant" as const,
      content: msg.content,
      ...(i < 3 ? {
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      } : {}),
    }));

    const aiTools: ToolSet = {};
    for (const t of tools) {
      const agentTool = t;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (aiTools as any)[t.name] = tool({
        description: t.description,
        inputSchema: t.inputSchema,
        execute: async (input: unknown) => {
          const result = await agentTool.execute(toolContext, input);
          if (result.ok) return result.value;
          return `[Erro]: ${result.error.message}`;
        },
      } as any);
    }

    logger.info("ClaudeAdapter run", { orgId: params.orgId, hasTools, toolNames: tools.map((t) => t.name) });

    try {
      const result = await Promise.race([
        generateText({
          model: anthropic(model),
          system: {
            role: "system" as const,
            content: systemContent,
            providerOptions: {
              anthropic: { cacheControl: { type: "ephemeral" } },
            },
          },
          messages,
          ...(hasTools ? { tools: aiTools, stopWhen: stepCountIs(MAX_STEPS_WITH_TOOLS) } : {}),
          maxOutputTokens: 1024,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AGENT_TIMEOUT")), timeoutMs),
        ),
      ]);

      const usage = result.usage;

      logger.info("ClaudeAdapter result", {
        orgId: params.orgId,
        steps: result.steps?.length ?? 0,
        finishReason: result.finishReason,
        textLength: result.text.length,
      });

      return Ok({
        reply: result.text,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        cacheReadTokens: (result.providerMetadata?.anthropic?.cacheReadInputTokens as number) ?? 0,
        cacheCreationTokens: (result.providerMetadata?.anthropic?.cacheCreationInputTokens as number) ?? 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Claude adapter error", { error: message, orgId: params.orgId });

      if (message === "AGENT_TIMEOUT") {
        return Err({ code: "TIMEOUT", message: `Agent run timed out after ${timeoutMs / 1000}s` });
      }
      return Err({ code: "API_ERROR", message });
    }
  }
}
