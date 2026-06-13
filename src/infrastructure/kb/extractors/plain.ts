import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import type { ExtractError } from "@/domain/ports/document-text-extractor";

export async function extractPlainText(buffer: Buffer): Promise<Result<string, ExtractError>> {
  try {
    const text = buffer.toString("utf-8").trim();
    if (!text) {
      return Err({ code: "EXTRACT_FAILED", message: "Arquivo vazio ou ilegível." });
    }
    return Ok(text);
  } catch (err) {
    return Err({
      code: "EXTRACT_FAILED",
      message: err instanceof Error ? err.message : "Falha ao ler arquivo de texto.",
    });
  }
}
