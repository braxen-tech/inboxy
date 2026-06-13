const DEFAULT_CHUNK_CHARS = 3200;
const DEFAULT_OVERLAP_CHARS = 400;

export interface ChunkTextOptions {
  chunkChars?: number;
  overlapChars?: number;
}

export function chunkText(text: string, options: ChunkTextOptions = {}): string[] {
  const chunkChars = options.chunkChars ?? DEFAULT_CHUNK_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (!normalized) return [];
  if (normalized.length <= chunkChars) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkChars, normalized.length);

    if (end < normalized.length) {
      const paragraphBreak = normalized.lastIndexOf("\n\n", end);
      const lineBreak = normalized.lastIndexOf("\n", end);
      const spaceBreak = normalized.lastIndexOf(" ", end);
      const breakAt = Math.max(paragraphBreak, lineBreak, spaceBreak);
      if (breakAt > start + chunkChars * 0.5) {
        end = breakAt;
      }
    }

    const piece = normalized.slice(start, end).trim();
    if (piece) chunks.push(piece);

    if (end >= normalized.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks;
}
