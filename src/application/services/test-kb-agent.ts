import type { SupabaseClient } from "@supabase/supabase-js";
import { ClaudeAdapter } from "@/infrastructure/adapters/claude/adapter";
import { PgVectorKnowledgeRetriever } from "@/infrastructure/adapters/pgvector/knowledge-retriever";
import { createVoyageEmbeddingAdapter } from "@/infrastructure/adapters/voyage/embedding-adapter";
import { LookupKnowledgeTool } from "@/infrastructure/tools/lookup-knowledge";
import { InMemoryToolRegistry } from "@/infrastructure/tools/registry";
import { LOOKUP_KNOWLEDGE_TOOL } from "@/lib/plans";
import type { KnowledgeRetriever, Chunk } from "@/domain/ports/knowledge-retriever";
import {
  toOrgId,
  toMessageId,
  toConversationId,
} from "@/domain/value-objects";

export interface KbAgentTestChunk {
  content: string;
  score: number;
  documentTitle: string;
}

export interface KbAgentTestLookupCall {
  query: string;
  chunks: KbAgentTestChunk[];
}

export interface KbAgentTestOutput {
  reply: string;
  lookupCalls: KbAgentTestLookupCall[];
  directChunks: KbAgentTestChunk[];
  usedLookupKnowledge: boolean;
  hasIndexedDocuments: boolean;
  inputTokens: number;
  outputTokens: number;
}

const MAX_QUESTION_LENGTH = 1000;

function mapChunks(chunks: Chunk[]): KbAgentTestChunk[] {
  return chunks.map((chunk) => ({
    content: chunk.content,
    score: chunk.score,
    documentTitle: chunk.documentTitle,
  }));
}

function createCapturingRetriever(inner: KnowledgeRetriever): {
  retriever: KnowledgeRetriever;
  calls: KbAgentTestLookupCall[];
} {
  const calls: KbAgentTestLookupCall[] = [];

  const retriever: KnowledgeRetriever = {
    async retrieve(orgId, query, k) {
      const result = await inner.retrieve(orgId, query, k);
      if (result.ok) {
        calls.push({ query, chunks: mapChunks(result.value) });
      }
      return result;
    },
  };

  return { retriever, calls };
}

async function orgHasReadyKbDocuments(db: SupabaseClient, orgId: string): Promise<boolean> {
  const { count, error } = await db
    .from("kb_documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "ready");

  if (error) return false;
  return (count ?? 0) > 0;
}

export async function runKbAgentTest(
  db: SupabaseClient,
  orgId: string,
  question: string,
): Promise<{ result?: KbAgentTestOutput; error?: string }> {
  const trimmed = question.trim();
  if (!trimmed) {
    return { error: "Digite uma pergunta para testar." };
  }
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return { error: `A pergunta deve ter no máximo ${MAX_QUESTION_LENGTH} caracteres.` };
  }

  const { data: org, error: orgError } = await db
    .from("organizations")
    .select("system_prompt, knowledge_base, model, language")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    return { error: "Organização não encontrada." };
  }

  const hasIndexedDocuments = await orgHasReadyKbDocuments(db, orgId);
  const hasManualKb = Boolean(org.knowledge_base?.trim());

  if (!hasIndexedDocuments && !hasManualKb) {
    return {
      error: "Adicione texto manual ou documentos indexados antes de testar o agente.",
    };
  }

  const voyage = createVoyageEmbeddingAdapter();
  if (hasIndexedDocuments && !voyage) {
    return { error: "VOYAGE_API_KEY não configurada — necessária para buscar documentos." };
  }

  let directChunks: KbAgentTestChunk[] = [];
  let lookupCalls: KbAgentTestLookupCall[] = [];
  const tools = [];

  if (hasIndexedDocuments && voyage) {
    const baseRetriever = new PgVectorKnowledgeRetriever(db, voyage);
    const directResult = await baseRetriever.retrieve(toOrgId(orgId), trimmed, 5);
    if (directResult.ok) {
      directChunks = mapChunks(directResult.value);
    }

    const { retriever, calls } = createCapturingRetriever(baseRetriever);
    lookupCalls = calls;

    const registry = new InMemoryToolRegistry();
    registry.register(new LookupKnowledgeTool(retriever));
    tools.push(
      ...registry.getToolsForOrg(toOrgId(orgId), [LOOKUP_KNOWLEDGE_TOOL]),
    );
  }

  const agentRunner = new ClaudeAdapter();
  const agentResult = await agentRunner.run({
    systemPrompt: org.system_prompt ?? "",
    knowledgeBase: org.knowledge_base ?? "",
    history: [
      {
        id: toMessageId("kb-preview"),
        organizationId: toOrgId(orgId),
        conversationId: toConversationId("kb-preview"),
        direction: "inbound",
        content: trimmed,
        externalMessageId: null,
        status: "received",
        aiMetadata: null,
        correlationId: null,
        createdAt: new Date(),
      },
    ],
    tools,
    toolContext: {
      orgId: toOrgId(orgId),
      contactPhone: "",
      conversationId: "kb-preview",
    },
    orgId: toOrgId(orgId),
    model: org.model ?? "claude-sonnet-4-20250514",
    language: org.language ?? "português",
  });

  if (!agentResult.ok) {
    return { error: agentResult.error.message };
  }

  return {
    result: {
      reply: agentResult.value.reply,
      lookupCalls,
      directChunks,
      usedLookupKnowledge: lookupCalls.length > 0,
      hasIndexedDocuments,
      inputTokens: agentResult.value.inputTokens,
      outputTokens: agentResult.value.outputTokens,
    },
  };
}
