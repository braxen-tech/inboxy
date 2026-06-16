import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import type { ExtractError } from "@/domain/ports/document-text-extractor";
import { ensurePdfServerPolyfills } from "./pdf-polyfill";

export async function extractPdfText(buffer: Buffer): Promise<Result<string, ExtractError>> {
  try {
    await ensurePdfServerPolyfills();
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = result.text?.trim() ?? "";
      if (!text) {
        return Err({
          code: "EXTRACT_FAILED",
          message:
            "PDF sem texto selecionável; envie um PDF com texto ou converta para DOCX/TXT.",
        });
      }
      return Ok(text);
    } finally {
      await parser.destroy();
    }
  } catch (err) {
    return Err({
      code: "EXTRACT_FAILED",
      message: err instanceof Error ? err.message : "Falha ao extrair texto do PDF.",
    });
  }
}
