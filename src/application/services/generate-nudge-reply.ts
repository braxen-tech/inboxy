import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { Message } from "@/domain/entities";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import type { AgentError, AgentOutput } from "@/domain/ports";
import { resolveAgentModel } from "@/lib/agent-models";
import { wrapAgentModelForPostHog } from "@/lib/agent-telemetry";
import { logger } from "@/lib/logger";

const NUDGE_TIMEOUT_MS = 30_000;

interface GenerateNudgeParams {
  systemPrompt: string;
  knowledgeBase: string;
  history: Message[];
  model: string;
  language: string;
  orgId: string;
  conversationId: string;
  reason?: string;
}

export async function generateNudgeReply(
  params: GenerateNudgeParams,
): Promise<Result<AgentOutput, AgentError>> {
  const resolvedModel = resolveAgentModel(params.model);

  const historyText = params.history
    .slice(-20)
    .map((m) => `${m.direction === "inbound" ? "Cliente" : "Assistente"}: ${m.content}`)
    .join("\n");

  const taskLines = params.reason
    ? [
        `Contexto do agendamento: ${params.reason}`,
        "Gere UMA mensagem curta (1-3 frases) para retomar a conversa no horário combinado.",
      ]
    : [
        "O cliente parou de responder após sua última mensagem.",
        "Gere UMA mensagem curta (1-3 frases) para retomar a conversa.",
      ];

  const systemContent = [
    params.systemPrompt,
    "",
    "## Base de Conhecimento",
    params.knowledgeBase,
    "",
    "## Tarefa",
    ...taskLines,
    "- Referencie o contexto da conversa (não seja genérico)",
    "- Tom amigável, não invasivo",
    "- Inclua uma pergunta aberta ou CTA claro",
    "- Não peça desculpas excessivas",
    "- Não mencione que é um follow-up automático",
    `- Responda em ${params.language}`,
    "",
    "## Histórico recente",
    historyText,
  ].join("\n");

  const tracedModel = wrapAgentModelForPostHog(anthropic(resolvedModel), {
    orgId: params.orgId,
    conversationId: params.conversationId,
    hasTools: false,
    modelName: resolvedModel,
  });

  try {
    const result = await Promise.race([
      generateText({
        model: tracedModel,
        system: systemContent,
        prompt: "Gere a mensagem de retomada agora.",
        maxOutputTokens: 512,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AGENT_TIMEOUT")), NUDGE_TIMEOUT_MS),
      ),
    ]);

    const usage = result.usage;

    return Ok({
      reply: result.text,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Nudge generation error", {
      error: message,
      orgId: params.orgId,
      conversationId: params.conversationId,
    });

    if (message === "AGENT_TIMEOUT") {
      return Err({
        code: "TIMEOUT",
        message: `Nudge generation timed out after ${NUDGE_TIMEOUT_MS / 1000}s`,
      });
    }
    return Err({ code: "API_ERROR", message });
  }
}
