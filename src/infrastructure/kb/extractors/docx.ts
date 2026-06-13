import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import type { ExtractError } from "@/domain/ports/document-text-extractor";

export async function extractDocxText(buffer: Buffer): Promise<Result<string, ExtractError>> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value?.trim() ?? "";
    if (!text) {
      return Err({ code: "EXTRACT_FAILED", message: "DOCX vazio ou sem texto extraível." });
    }
    return Ok(text);
  } catch (err) {
    return Err({
      code: "EXTRACT_FAILED",
      message: err instanceof Error ? err.message : "Falha ao extrair texto do DOCX.",
    });
  }
}
