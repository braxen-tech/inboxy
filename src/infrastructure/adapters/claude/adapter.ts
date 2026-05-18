import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { AgentRunner, AgentRunParams, AgentOutput, AgentError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { logger } from "@/lib/logger";

const AGENT_TIMEOUT_MS = 45_000;

export class ClaudeAdapter implements AgentRunner {
  async run(params: AgentRunParams): Promise<Result<AgentOutput, AgentError>> {
    const { systemPrompt, knowledgeBase, history, model, language } = params;

    const systemContent = [
      systemPrompt,
      "",
      `## Base de Conhecimento`,
      knowledgeBase,
      "",
      `## Instruções operacionais`,
      `- Responda sempre em ${language}.`,
      `- Seja profissional, cordial e direto.`,
      `- Se não souber a resposta, diga que não sabe e oriente o paciente a entrar em contato pelo telefone do estabelecimento.`,
      `- Nunca invente informações que não estejam na base de conhecimento.`,
    ].join("\n");

    const messages = history.map((msg) => ({
      role: msg.direction === "inbound" ? "user" as const : "assistant" as const,
      content: msg.content,
    }));

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
          maxOutputTokens: 1024,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AGENT_TIMEOUT")), AGENT_TIMEOUT_MS),
        ),
      ]);

      const usage = result.usage;

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
        return Err({ code: "TIMEOUT", message: "Agent run timed out after 45s" });
      }
      return Err({ code: "API_ERROR", message });
    }
  }
}
