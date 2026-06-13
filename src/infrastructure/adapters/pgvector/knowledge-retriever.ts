import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeRetriever, Chunk, RetrieveError } from "@/domain/ports/knowledge-retriever";
import type { EmbeddingProvider } from "@/domain/ports/embedding-provider";
import type { OrgId } from "@/domain/value-objects";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { logger } from "@/lib/logger";

interface MatchRow {
  content: string;
  score: number;
  document_title: string;
}

export class PgVectorKnowledgeRetriever implements KnowledgeRetriever {
  constructor(
    private db: SupabaseClient,
    private embeddingProvider: EmbeddingProvider,
  ) {}

  async retrieve(orgId: OrgId, query: string, k: number): Promise<Result<Chunk[], RetrieveError>> {
    const trimmed = query.trim();
    if (!trimmed) {
      return Ok([]);
    }

    const embedResult = await this.embeddingProvider.embed([trimmed], { inputType: "query" });
    if (!embedResult.ok) {
      return Err({
        code: "RETRIEVAL_FAILED",
        message: embedResult.error.message,
      });
    }

    const embedding = embedResult.value[0];
    if (!embedding) {
      return Err({ code: "RETRIEVAL_FAILED", message: "Empty query embedding" });
    }

    const { data, error } = await this.db.rpc("match_kb_chunks", {
      p_org_id: orgId,
      p_embedding: JSON.stringify(embedding),
      p_match_count: k,
    });

    if (error) {
      logger.error("match_kb_chunks failed", { orgId, error: error.message });
      return Err({ code: "RETRIEVAL_FAILED", message: error.message });
    }

    const rows = (data ?? []) as MatchRow[];
    return Ok(
      rows.map((row) => ({
        content: row.content,
        score: row.score,
        documentTitle: row.document_title,
      })),
    );
  }
}
