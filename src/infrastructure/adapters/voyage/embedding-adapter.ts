import type { EmbeddingProvider, EmbeddingError } from "@/domain/ports/embedding-provider";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { logger } from "@/lib/logger";
import { buildEmbeddingBatches } from "./embedding-batches";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";
const INTER_BATCH_DELAY_MS = 1_200;
const MAX_RETRIES = 8;
const INITIAL_RETRY_DELAY_MS = 2_000;
const MAX_RETRY_DELAY_MS = 60_000;

export function isRetryableVoyageStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503;
}

export function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;

  const seconds = Number(header);
  if (!Number.isNaN(seconds)) {
    return Math.max(0, seconds * 1_000);
  }

  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number, retryAfterHeader: string | null): number {
  const retryAfter = parseRetryAfterMs(retryAfterHeader);
  if (retryAfter != null) return retryAfter;
  return Math.min(INITIAL_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

function mapVoyageError(status: number, body: string): EmbeddingError {
  if (status === 429) {
    return {
      code: "RATE_LIMITED",
      message: "Limite de requisições da Voyage atingido. Tente novamente em alguns minutos.",
    };
  }

  const lower = body.toLowerCase();
  if (status === 413 || lower.includes("token") || lower.includes("too large")) {
    return {
      code: "EMBEDDING_FAILED",
      message: "Documento grande demais para indexar de uma vez. Divida em arquivos menores.",
    };
  }

  return {
    code: "EMBEDDING_FAILED",
    message: `Voyage API error (${status})`,
  };
}

async function postEmbeddings(
  apiKey: string,
  batch: string[],
  inputType: "document" | "query",
): Promise<Result<number[][], EmbeddingError>> {
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: batch,
        model: VOYAGE_MODEL,
        input_type: inputType,
        truncation: true,
      }),
    });

    if (response.ok) {
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

      return Ok(embeddings);
    }

    lastStatus = response.status;
    lastBody = await response.text();

    if (isRetryableVoyageStatus(response.status) && attempt < MAX_RETRIES) {
      const delayMs = retryDelayMs(attempt, response.headers.get("retry-after"));
      logger.warn("Voyage embedding rate limited, retrying", {
        status: response.status,
        attempt: attempt + 1,
        delayMs,
        batchSize: batch.length,
      });
      await sleep(delayMs);
      continue;
    }

    logger.error("Voyage embedding failed", { status: response.status, body: lastBody });
    return Err(mapVoyageError(response.status, lastBody));
  }

  logger.error("Voyage embedding exhausted retries", { status: lastStatus, body: lastBody });
  return Err(mapVoyageError(lastStatus || 429, lastBody));
}

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
      const inputType = options?.inputType ?? "document";
      const allEmbeddings: number[][] = [];
      const batches =
        inputType === "query" && texts.length === 1
          ? [texts]
          : buildEmbeddingBatches(texts);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]!;
        const batchResult = await postEmbeddings(this.apiKey, batch, inputType);
        if (!batchResult.ok) {
          return batchResult;
        }

        allEmbeddings.push(...batchResult.value);

        if (batchIndex + 1 < batches.length) {
          await sleep(INTER_BATCH_DELAY_MS);
        }
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
