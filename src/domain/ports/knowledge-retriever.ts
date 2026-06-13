/**
 * KnowledgeRetriever port — RAG with pgvector + Voyage embeddings.
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
