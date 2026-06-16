import type { Result } from "../errors";

export type EmbeddingError =
  | { code: "EMBEDDING_FAILED"; message: string }
  | { code: "RATE_LIMITED"; message: string };

export interface EmbeddingProvider {
  embed(
    texts: string[],
    options?: { inputType?: "document" | "query" },
  ): Promise<Result<number[][], EmbeddingError>>;
}
