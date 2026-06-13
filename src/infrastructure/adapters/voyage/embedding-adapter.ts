import type { EmbeddingProvider, EmbeddingError } from "@/domain/ports/embedding-provider";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { logger } from "@/lib/logger";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";
const MAX_BATCH_SIZE = 128;

export class VoyageEmbeddingAdapter implements EmbeddingProvider {
  constructor(private apiKey: string) {}

  async embed(
    texts: string[],
    options?: { inputType?: "document" | "query" },
  ): Promise<Result<number[][], EmbeddingError>> {
    if (texts.length === 0) {
      return Ok([]);
    }

    try {
      const allEmbeddings: number[][] = [];

      for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
        const batch = texts.slice(i, i + MAX_BATCH_SIZE);
        const response = await fetch(VOYAGE_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: batch,
            model: VOYAGE_MODEL,
            input_type: options?.inputType ?? "document",
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          logger.error("Voyage embedding failed", { status: response.status, body });
          return Err({
            code: "EMBEDDING_FAILED",
            message: `Voyage API error (${response.status})`,
          });
        }

        const json = (await response.json()) as {
          data?: Array<{ embedding: number[] }>;
        };

        const embeddings = json.data?.map((row) => row.embedding) ?? [];
        if (embeddings.length !== batch.length) {
          return Err({
            code: "EMBEDDING_FAILED",
            message: "Voyage returned unexpected embedding count",
          });
        }

        allEmbeddings.push(...embeddings);
      }

      return Ok(allEmbeddings);
    } catch (err) {
      logger.error("Voyage embedding exception", { error: String(err) });
      return Err({
        code: "EMBEDDING_FAILED",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function createVoyageEmbeddingAdapter(): VoyageEmbeddingAdapter | null {
  const apiKey = process.env.VOYAGE_API_KEY?.trim();
  if (!apiKey) return null;
  return new VoyageEmbeddingAdapter(apiKey);
}
