/** Conservative token estimate for Voyage batch sizing (no tokenizer in Node). */
const ESTIMATED_CHARS_PER_TOKEN = 3;
/** voyage-3 allows 120k tokens/request — stay well below. */
const MAX_BATCH_TOKENS = 60_000;
const MAX_BATCH_ITEMS = 8;

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / ESTIMATED_CHARS_PER_TOKEN);
}

export function buildEmbeddingBatches(texts: string[]): string[][] {
  if (texts.length === 0) return [];

  const batches: string[][] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const text of texts) {
    const tokens = estimateTokenCount(text);

    if (
      current.length > 0 &&
      (current.length >= MAX_BATCH_ITEMS || currentTokens + tokens > MAX_BATCH_TOKENS)
    ) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }

    current.push(text);
    currentTokens += tokens;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}
