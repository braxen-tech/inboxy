/**
 * KnowledgeRetriever port — reserved for v1.4 (RAG with pgvector).
 * Not implemented in MVP. KB is inline in the system prompt.
 */

import type { Result } from "../errors";
import type { OrgId } from "../value-objects";

export interface Chunk {
  content: string;
  score: number;
  documentTitle: string;
}

export type RetrieveError = { code: "RETRIEVAL_FAILED"; message: string };

export interface KnowledgeRetriever {
  retrieve(orgId: OrgId, query: string, k: number): Promise<Result<Chunk[], RetrieveError>>;
}
