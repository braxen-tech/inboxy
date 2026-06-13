import type { Result } from "../errors";

export type ExtractError = { code: "EXTRACT_FAILED" | "UNSUPPORTED"; message: string };

export interface DocumentTextExtractor {
  extract(buffer: Buffer, mimeType: string, filename: string): Promise<Result<string, ExtractError>>;
}
